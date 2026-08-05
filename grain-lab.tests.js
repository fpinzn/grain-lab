// Test suite for grain-lab.html. Appended to the page by run-tests.sh and executed
// in headless Chrome; results are written into #results and scraped from the DOM.
//
// Known harness limits (NOT product bugs):
//   * requestAnimationFrame does not fire under --virtual-time-budget, so the
//     playback/record clocks only run via their timer fallback. Waits below allow
//     for the 400ms fallback probe.
//   * Headless has no compositor, so canvas captureStream yields an empty file.
//     The record test therefore asserts an honest failure, not a working video.
(async function(){
  var log=[],ok=true;
  var sleep=function(ms){return new Promise(function(r){setTimeout(r,ms)})};
  function t(n,c,e){log.push((c?'PASS':'FAIL')+' · '+n+(e?' · '+e:''));if(!c)ok=false}
  function $(id){return document.getElementById(id)}
  var view=$('view'), ov=$('ov'), note=$('exportnote'), mnote=$('motionnote');

  function px(){
    var x=view.getContext('2d').getImageData(0,0,view.width,view.height).data,s=0;
    for(var i=0;i<x.length;i+=4000)s+=x[i]*3+x[i+1]*7+x[i+2]*11;
    return s;
  }
  function pe(ty,n,x,y){
    n.dispatchEvent(new PointerEvent(ty,{clientX:x,clientY:y,pointerId:1,
      bubbles:true,cancelable:true,isPrimary:true}));
  }
  function mid(n){var r=n.getBoundingClientRect();return[r.left+r.width/2,r.top+r.height/2]}
  async function set(id,v){
    var e=$(id);
    if(e.type==='checkbox')e.checked=v;else e.value=v;
    e.dispatchEvent(new Event('input',{bubbles:true}));
    await sleep(400);
  }
  async function settle(id,v){          // change + full-quality settle
    var e=$(id);
    e.value=v;
    e.dispatchEvent(new Event('input',{bubbles:true}));
    e.dispatchEvent(new Event('change',{bubbles:true}));
    await sleep(600);
  }
  async function waitFor(fn,tries){
    for(var i=0;i<(tries||300);i++){if(fn())return true;await sleep(50)}
    return false;
  }
  async function exported(){await waitFor(function(){return !$('download').disabled})}
  function tracks(){return document.querySelectorAll('#tracks .track')}
  function scale(){return +ov.getAttribute('viewBox').split(' ')[2]/ov.getBoundingClientRect().width}
  function grip(){
    var r=ov.querySelector('.ctr');
    return[+r.getAttribute('x')+ +r.getAttribute('width')/2,
           +r.getAttribute('y')+ +r.getAttribute('height')/2];
  }
  function select(i){
    var h=ov.querySelectorAll('.hit')[i], c=mid(h);
    pe('pointerdown',h,c[0],c[1]);pe('pointerup',h,c[0],c[1]);
  }

  try{
    // ================= layout =================
    var app=getComputedStyle(document.querySelector('.app')).gridTemplateColumns.split(' ');
    t('app has three columns',app.length===3,app.join(' | '));
    var railR=document.querySelector('.rail').getBoundingClientRect();
    var motR=document.querySelector('.motion').getBoundingClientRect();
    var stgR=document.querySelector('.stage').getBoundingClientRect();
    t('motion sits between the rail and the picture',
      motR.left>=railR.right-1&&stgR.left>=motR.right-1,
      'rail '+Math.round(railR.right)+' motion '+Math.round(motR.left)+'-'+Math.round(motR.right)+
      ' stage '+Math.round(stgR.left));
    t('picture shares the viewport with the timeline',
      stgR.top<motR.bottom&&stgR.width>320,'stage width '+Math.round(stgR.width));

    // ================= editor =================
    t('renders at preview size',view.width===1440&&view.height===960&&px()>0);
    t('chips and hit paths built',
      document.querySelectorAll('#chips .chip').length===4&&ov.querySelectorAll('.hit').length===4);
    select(2); await sleep(300);
    t('selection shows handles, spokes and grip',
      ov.querySelectorAll('.pt').length===8&&ov.querySelectorAll('.spoke').length===8&&
      ov.querySelectorAll('.ctr').length===1);

    var sc=scale(), h0=ov.querySelectorAll('.pt')[0], before=+h0.getAttribute('cx'), p0=mid(h0);
    pe('pointerdown',h0,p0[0],p0[1]);pe('pointermove',h0,p0[0]+80,p0[1]);pe('pointerup',h0,p0[0]+80,p0[1]);
    await sleep(400);
    t('control point drag',Math.abs((+ov.querySelectorAll('.pt')[0].getAttribute('cx'))-(before+80*sc))<1.5);

    var g0=grip(), gc=mid(ov.querySelector('.ctr'));
    pe('pointerdown',ov.querySelector('.ctr'),gc[0],gc[1]);
    pe('pointermove',ov.querySelector('.ctr'),gc[0],gc[1]+50);
    pe('pointerup',ov.querySelector('.ctr'),gc[0],gc[1]+50);
    await sleep(400);
    t('body drag',Math.abs((grip()[1]-g0[1])-50*sc)<1.5);

    var cv=view.getBoundingClientRect(), pt0=ov.querySelectorAll('.pt')[0];
    var scr=new DOMPoint(+pt0.getAttribute('cx'),+pt0.getAttribute('cy')).matrixTransform(ov.getScreenCTM());
    t('overlay in pixel register with the canvas',
      Math.abs(scr.x-(cv.left+ +pt0.getAttribute('cx')/view.width*cv.width))<0.35&&
      Math.abs(scr.y-(cv.top+ +pt0.getAttribute('cy')/view.height*cv.height))<0.35);

    var base=px();
    await set('linear',true);  t('linear gradient fill',px()!==base);
    await set('linear',false); t('linear toggles back',px()===base);
    await set('tension',0);    t('curve tension',px()!==base);
    await set('tension',100);  t('tension restores',px()===base);
    await set('blobs',2);
    t('layer count drives chips and hits',
      ov.querySelectorAll('.hit').length===2&&document.querySelectorAll('#chips .chip').length===2);
    await set('blobs',4);

    // ================= motion tracks =================
    t('no tracks at start',tracks().length===0);
    var opts=[].map.call($('addprop').options,function(o){return o.value}).filter(Boolean);
    t('layers, aspect and resolution are not animatable',
      opts.indexOf('blobs')<0&&opts.indexOf('aspect')<0&&opts.indexOf('scale')<0);
    t('colours, sliders and shape pose are animatable',
      opts.indexOf('c2')>=0&&opts.indexOf('spread')>=0&&opts.indexOf('shapes')>=0);

    await set('addprop','spread');
    t('adding a track builds a card',tracks().length===1);
    t('added property leaves the add list',
      [].map.call($('addprop').options,function(o){return o.value}).indexOf('spread')<0);
    var row=tracks()[0];
    t('card is three stacked rows',row.querySelectorAll('.trow').length===2&&!!row.querySelector('.tto'));
    t('card shows A from the rail',row.querySelector('.tfrom').textContent==='55',
      row.querySelector('.tfrom').textContent);
    t('card has easing, curve glyph and two window grips',
      !!row.querySelector('select')&&!!row.querySelector('.curve path')&&
      row.querySelectorAll('.wgrip').length===2);
    t('B defaults away from A',+row.querySelector('input[type=range]').value!==55);

    await set('spread',20);
    t('A follows the rail live',tracks()[0].querySelector('.tfrom').textContent==='20');
    await set('spread',55);

    var atZero=px();
    await settle('scrub',500);
    t('scrubbing changes the render',px()!==atZero);
    await settle('scrub',0);
    t('scrub 0 restores the base render',px()===atZero);

    var sel=tracks()[0].querySelector('select');
    sel.value='hold';sel.dispatchEvent(new Event('input',{bubbles:true}));await sleep(400);
    await settle('scrub',250);
    t('hold easing pins the value until the end',px()===atZero);
    sel.value='linear';sel.dispatchEvent(new Event('input',{bubbles:true}));await sleep(400);
    await settle('scrub',250);
    t('linear easing moves at 25%',px()!==atZero);
    await settle('scrub',0);

    await set('addprop','c2');
    t('colour track has a picker and an A swatch',
      !!tracks()[1].querySelector('input[type=color]')&&!!tracks()[1].querySelector('.sw-mini'));

    // ================= shape poses =================
    await set('addprop','shapes');
    t('pose picker appears with the shape track',$('poserow').hidden===false);
    t('pose A is the default',$('poseA').getAttribute('aria-pressed')==='true');
    var poseA=px();
    $('poseB').click(); await sleep(500);
    t('switching to pose B',$('poseB').getAttribute('aria-pressed')==='true');
    select(0); await sleep(300);
    var gb=mid(ov.querySelector('.ctr'));
    pe('pointerdown',ov.querySelector('.ctr'),gb[0],gb[1]);
    pe('pointermove',ov.querySelector('.ctr'),gb[0]+70,gb[1]);
    pe('pointerup',ov.querySelector('.ctr'),gb[0]+70,gb[1]);
    await sleep(600);
    t('editing pose B changes pose B',px()!==poseA);
    $('poseA').click(); await sleep(600);
    t('pose A is untouched by pose B edits',px()===poseA);

    // ================= bake and playback =================
    await set('loop',2);
    await set('fps','12');
    await set('bakew','480');
    $('playbtn').click();
    t('bake reports progress and completes',
      await waitFor(function(){return /^Baked /.test(mnote.textContent)}),mnote.textContent);
    // 2s x 12fps = 24 frames; ping-pong bakes half + 1
    t('ping-pong bakes only half the frames',/Baked 13 frames at 480 × 320/.test(mnote.textContent),
      mnote.textContent);
    await sleep(900);   // let the clock's rAF-fallback probe arm
    t('playback runs at the baked size',view.width===480&&view.height===320,view.width+'x'+view.height);
    t('handles hidden during playback',ov.hasAttribute('hidden'));
    await waitFor(function(){return /pause/.test($('playbtn').textContent)},200);
    $('playbtn').click();
    await waitFor(function(){return /play/.test($('playbtn').textContent)},200);
    await sleep(500);
    t('stop restores the editor preview',view.width===1440&&view.height===960);

    await set('mode','cycle');
    $('playbtn').click();
    await waitFor(function(){return /^Baked /.test(mnote.textContent)});
    t('cycle mode bakes the whole loop',/Baked 24 frames/.test(mnote.textContent),mnote.textContent);
    await waitFor(function(){return /pause/.test($('playbtn').textContent)},200);
    $('playbtn').click();
    await waitFor(function(){return /play/.test($('playbtn').textContent)},200);
    await set('mode','pingpong');

    await set('contrast',40);
    $('playbtn').click();
    t('editing a property forces a re-bake',
      await waitFor(function(){return /^Baked /.test(mnote.textContent)}));
    await waitFor(function(){return /pause/.test($('playbtn').textContent)},200);
    $('playbtn').click();
    await waitFor(function(){return /play/.test($('playbtn').textContent)},200);
    await sleep(600);

    // ================= record =================
    // Headless captures no frames, so the correct outcome is an honest refusal
    // rather than a zero-byte "video". A real browser should produce a file.
    var dl=null, realClick=HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click=function(){dl=this.download};
    $('recbtn').click();
    await waitFor(function(){
      return dl||/refused|cannot|No WebM|Could not|failed|empty file|nothing to record/i.test(mnote.textContent);
    },600);
    HTMLAnchorElement.prototype.click=realClick;
    if(dl){
      t('record delivers a .webm named for its size and length',/480x320-2s\.webm$/.test(dl),dl);
    }else{
      t('record reports a reason instead of hanging',
        /refused|cannot|No WebM|Could not|failed|empty file|nothing to record/i.test(mnote.textContent),
        mnote.textContent);
    }
    t('record button always returns to idle',
      /rec/.test($('recbtn').textContent)&&$('recbtn').disabled===false);

    // ================= export delivery =================
    await set('amount',0);
    await set('scale','1');
    delete window.claude;
    var clicked=null;
    HTMLAnchorElement.prototype.click=function(){clicked=this.download};
    $('download').click(); await exported();
    HTMLAnchorElement.prototype.click=realClick;
    t('top-level export downloads and says so',
      /\.png$/.test(clicked||'')&&/^Downloaded /.test(note.textContent),note.textContent);

    var seen=null;
    window.claude={downloads:{save:function(r){seen=r;return Promise.resolve({status:'saved'})}}};
    $('download').click(); await exported();
    t('uses the downloads capability when present',
      !!seen&&seen.data instanceof Blob&&/\.png$/.test(seen.filename)&&/^Saved /.test(note.textContent));

    window.claude={downloads:{save:function(){return Promise.reject({code:'declined'})}}};
    $('download').click(); await exported();
    t('a declined save is reported, not swallowed',note.textContent==='Save cancelled.',note.textContent);

    window.claude={downloads:{save:function(){return Promise.reject({code:'some_future_code'})}}};
    $('download').click(); await exported();
    t('unknown error codes degrade gracefully',/unavailable in this view/.test(note.textContent));

    await set('scale','2');
    window.claude={downloads:{save:function(){return Promise.reject({code:'too_large'})}}};
    $('download').click(); await exported();
    t('too_large explains itself and offers a smaller export',
      /too large/.test(note.textContent)&&$('retryscale').hidden===false);
    $('retryscale').click(); await sleep(400); await exported();
    t('the retry actually drops the resolution',$('scale').value==='1');
  }catch(e){
    log.push('THREW · '+e.message+' | '+((e.stack||'').split('\n')[1]||''));
    ok=false;
  }
  log.push(ok?'ALL PASS':'SOME FAILED');
  $('results').textContent='RESULTS\n'+log.join('\n');
})();
