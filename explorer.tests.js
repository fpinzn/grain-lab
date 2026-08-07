// Test suite for explorer.html. Appended to the page by run-tests.sh and run in
// headless Chrome; results are written into #results and scraped from the DOM.
//
// Two things to know when adding cases here:
//   * When both axes are set to the same parameter, the Y axis wins — a tile's
//     value comes from its row, not its column.
//   * The ramp is banded, so an exact stop colour only appears where a band edge
//     happens to land. Assert distances, not equality, away from the endpoints.
(async function(){
  var log=[],ok=true;
  var sleep=function(ms){return new Promise(function(r){setTimeout(r,ms)})};
  function t(n,c,e){log.push((c?'PASS':'FAIL')+' · '+n+(e?' · '+e:''));if(!c)ok=false}
  function $(id){return document.getElementById(id)}
  async function set(id,v){var e=$(id);
    if(e.type==='checkbox')e.checked=v;else e.value=v;
    e.dispatchEvent(new Event('input',{bubbles:true}));await sleep(300)}
  function tiles(){return document.querySelectorAll('#grid .tile')}
  function pxOf(cv){var d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data,s=0;
    for(var i=0;i<d.length;i+=97)s+=d[i];return s}
  try{
    t('grid renders 5x5 tiles by default',tiles().length===25,'got '+tiles().length);
    t('tiles are 128px canvases',tiles()[0].querySelector('canvas').width===128);
    t('tiles are not blank',pxOf(tiles()[0].querySelector('canvas'))>0);
    t('tiles differ across the grid',
      pxOf(tiles()[0].querySelector('canvas'))!==pxOf(tiles()[24].querySelector('canvas')));

    var hdr=document.querySelectorAll('#grid th');
    t('axes are labelled on both edges',hdr.length>=11&&/band/.test(hdr[0].textContent)&&/grain/.test(hdr[0].textContent),
      hdr[0].textContent);

    await set('gridn','3');
    t('grid size control works',tiles().length===9,'got '+tiles().length);
    await set('gridn','5');
    await set('tile','96');
    t('tile size control works',tiles()[0].querySelector('canvas').width===96);
    await set('tile','128');

    // axis change must change what varies
    var before=pxOf(tiles()[4].querySelector('canvas'));
    await set('ax','angle');
    t('changing the x axis rebuilds the plane',pxOf(tiles()[4].querySelector('canvas'))!==before);

    // integer axis dedupe: stops only has 2..4, so a 5-wide grid must collapse
    await set('ax','stops');
    var cols=document.querySelectorAll('#grid tr')[0].querySelectorAll('th').length-1;
    t('short integer axes do not repeat columns',cols===3,'columns '+cols);
    await set('ax','mid');

    // selection + detail
    tiles()[9].click(); await sleep(300);
    t('clicking a tile selects it',tiles()[9].getAttribute('aria-pressed')==='true');
    t('detail shows a 256px preview',$('big').querySelector('canvas').width===256);
    t('detail lists the parameters',$('pickmeta').children.length>=16);
    t('export enabled after a pick',$('save512').disabled===false);

    // travel
    var beforeBias=$('mid').value;
    $('recentre').click(); await sleep(400);
    t('centre here moves the base to the picked tile',$('mid').value!==beforeBias,
      beforeBias+' -> '+$('mid').value);
    t('the path is recorded',/path:/.test($('crumbs').textContent));

    // Live update: editing ANY parameter must refresh the tiles and carry the
    // selection with them. Otherwise the highlight disappears and the detail —
    // and Export — keep serving the params from before the edit.
    await set('ax','mid'); await set('ay','amount'); await set('gridn','5');
    tiles()[6].click(); await sleep(300);
    var nameBefore=$('pickname').textContent;
    var bigBefore=pxOf($('big').querySelector('canvas'));
    var metaBefore=$('pickmeta').textContent;
    await set('steps',6);
    t('editing a parameter keeps the same cell selected',
      tiles()[6].getAttribute('aria-pressed')==='true'&&$('pickname').textContent===nameBefore);
    t('editing a parameter refreshes the detail preview',
      pxOf($('big').querySelector('canvas'))!==bigBefore);
    t('the detail metadata follows the edit',
      $('pickmeta').textContent!==metaBefore&&/steps6/.test($('pickmeta').textContent.replace(/\s/g,'')));
    t('export stays enabled through an edit',$('save512').disabled===false);
    await set('steps',24);

    // and the selection survives an axis swap, which rebuilds every tile
    await set('ay','chroma');
    t('the selection survives an axis change',tiles()[6].getAttribute('aria-pressed')==='true');
    await set('ay','amount');

    // shrinking the grid past the selected cell must drop it, not point at nothing
    tiles()[24].click(); await sleep(300);
    await set('gridn','3');
    t('a selection outside a smaller grid is cleared cleanly',
      $('save512').disabled===true&&/nothing selected/.test($('pickname').textContent),
      $('pickname').textContent);
    await set('gridn','5');


    // Dragging a control renders at half resolution for speed; releasing it must
    // restore full resolution, or the grid would stay soft after every edit.
    tiles()[6].click(); await sleep(300);      // the block above cleared the selection
    var sl=$('steps');
    sl.dispatchEvent(new PointerEvent('pointerdown',{pointerId:1,bubbles:true,cancelable:true,isPrimary:true}));
    sl.value=30; sl.dispatchEvent(new Event('input',{bubbles:true}));
    await sleep(300);
    t('dragging drops the tiles to half resolution',
      tiles()[0].querySelector('canvas').width===64,
      'width '+tiles()[0].querySelector('canvas').width);
    t('half-res tiles still occupy the full tile box',
      tiles()[0].querySelector('canvas').style.width==='128px');
    window.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,bubbles:true,cancelable:true,isPrimary:true}));
    await sleep(300);
    t('releasing restores full resolution',
      tiles()[0].querySelector('canvas').width===128,
      'width '+tiles()[0].querySelector('canvas').width);
    t('the selection survives the drag',tiles()[6].getAttribute('aria-pressed')==='true');
    await set('steps',24);

    // shapes mode
    await set('mode','shapes');
    t('form controls appear in shapes mode',$('shapegroup').style.display!=='none');
    t('shape axes are offered',[].map.call($('ax').options,function(o){return o.value}).indexOf('spread')>=0);
    var sh=pxOf(tiles()[12].querySelector('canvas'));
    await set('blobs',0);
    t('layers 0 falls back to the bare ramp',pxOf(tiles()[12].querySelector('canvas'))!==sh);
    await set('mode','gradient');

    // icon mask
    var c=tiles()[0].querySelector('canvas');
    var corner=c.getContext('2d').getImageData(1,1,1,1).data;
    t('icon mask clears the corners',corner[3]===0,'alpha '+corner[3]);
    await set('rounded',false);
    corner=tiles()[0].querySelector('canvas').getContext('2d').getImageData(1,1,1,1).data;
    t('mask off fills the corners',corner[3]===255,'alpha '+corner[3]);
    await set('rounded',true);

    // palette
    t('presets are listed',document.querySelectorAll('#pals .pal').length>=5);
    t('four swatches are editable',document.querySelectorAll('#swatches input[type=color]').length===4);
    var p0=pxOf(tiles()[0].querySelector('canvas'));
    document.querySelectorAll('#pals .pal')[0].click(); await sleep(400);
    t('choosing a preset repaints the grid',pxOf(tiles()[0].querySelector('canvas'))!==p0);


    // Endpoints must actually reach the palette. Both axes are pinned to the same
    // parameter so the sampled tile is not silently overridden by the other axis.
    await set('rounded',false); await set('amount',0);
    await set('angle',0); await set('stops',3);
    await set('ax','mid'); await set('ay','mid'); await set('gridn','5');
    var sw=document.querySelectorAll('#swatches input[type=color]');
    function hx(n){n=Math.round(n);return (n<16?'0':'')+n.toString(16)}
    function at(cv,fr){
      var y=Math.round((cv.height-1)*fr);
      var d=cv.getContext('2d').getImageData(Math.floor(cv.width/2),y,1,1).data;
      return '#'+hx(d[0])+hx(d[1])+hx(d[2]);
    }
    function close(a,b){
      function v(h,i){return parseInt(h.slice(1+i*2,3+i*2),16)}
      return Math.abs(v(a,0)-v(b,0))<=3&&Math.abs(v(a,1)-v(b,1))<=3&&Math.abs(v(a,2)-v(b,2))<=3;
    }
    tiles()[12].click(); await sleep(300);          // row 2, col 2 -> band pos 50%
    var bigc=$('big').querySelector('canvas');
    t('ramp reaches the first stop at the top',close(at(bigc,0.005),sw[0].value),
      at(bigc,0.005)+' vs '+sw[0].value);
    t('ramp reaches the last stop at the bottom',close(at(bigc,0.995),sw[2].value),
      at(bigc,0.995)+' vs '+sw[2].value);
    t('the band sits where band pos says',close(at(bigc,0.5),sw[1].value),
      at(bigc,0.5)+' vs '+sw[1].value);
    // Banding means the exact stop colour only appears wherever a band edge lands,
    // so compare distances instead of demanding an exact match.
    function dist(a,b){
      function v(h,i){return parseInt(h.slice(1+i*2,3+i*2),16)}
      var s2=0;for(var i=0;i<3;i++){var d2=v(a,i)-v(b,i);s2+=d2*d2}
      return Math.sqrt(s2);
    }
    var midAt12=dist(at(bigc,0.12),sw[1].value);   // still the band-pos-50% tile
    tiles()[0].click(); await sleep(300);           // row 0 -> band pos 12% (y axis wins)
    bigc=$('big').querySelector('canvas');
    var lowAt12=dist(at(bigc,0.12),sw[1].value);
    t('a lower band pos brings the band up the frame',lowAt12<midAt12*0.35,
      'distance at y=12%: '+Math.round(lowAt12)+' vs '+Math.round(midAt12)+' when centred');
    t('the ends still reach the palette at an off-centre band',
      close(at(bigc,0.005),sw[0].value)&&close(at(bigc,0.995),sw[2].value));
    await set('amount',14); await set('rounded',true); await set('ay','amount');

    log.push(ok?'ALL PASS':'SOME FAILED');
  }catch(e){log.push('THREW · '+e.message+' | '+((e.stack||'').split('\n')[1]||''));}
  $('results').textContent='RESULTS\n'+log.join('\n');
})();
