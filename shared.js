// ═══════════════════════════════════════════
// NEURAL NETWORK
// ═══════════════════════════════════════════
const canvas = document.getElementById('neural-canvas');
if(canvas){
  const ctx = canvas.getContext('2d');
  let W,H,nodes=[];
  let mouseX=window.innerWidth/2, mouseY=window.innerHeight/2;

  function resize(){ W=canvas.width=window.innerWidth; H=canvas.height=window.innerHeight; }
  resize(); window.addEventListener('resize',resize);

  class Node {
    constructor(){this.reset();}
    reset(){
      this.x=Math.random()*W; this.y=Math.random()*H;
      this.vx=(Math.random()-.5)*.38; this.vy=(Math.random()-.5)*.38;
      this.r=Math.random()*2+.8; this.gold=Math.random()<.18;
    }
    update(){
      const dx=mouseX-this.x,dy=mouseY-this.y,d=Math.sqrt(dx*dx+dy*dy);
      if(d<220){this.vx+=dx/d*.016;this.vy+=dy/d*.016;}
      this.vx*=.98;this.vy*=.98;
      this.x+=this.vx;this.y+=this.vy;
      if(this.x<-20)this.x=W+20;if(this.x>W+20)this.x=-20;
      if(this.y<-20)this.y=H+20;if(this.y>H+20)this.y=-20;
    }
  }
  for(let i=0;i<88;i++) nodes.push(new Node());

  function drawNetwork(){
    ctx.clearRect(0,0,W,H);
    const mx=160;
    for(let i=0;i<nodes.length;i++){
      for(let j=i+1;j<nodes.length;j++){
        const dx=nodes[i].x-nodes[j].x,dy=nodes[i].y-nodes[j].y;
        const d=Math.sqrt(dx*dx+dy*dy);
        if(d<mx){
          const a=(1-d/mx)*.35;
          const g=nodes[i].gold||nodes[j].gold;
          ctx.strokeStyle=g?`rgba(196,163,90,${a*.6})`:`rgba(74,158,255,${a})`;
          ctx.lineWidth=.5;
          ctx.beginPath();ctx.moveTo(nodes[i].x,nodes[i].y);ctx.lineTo(nodes[j].x,nodes[j].y);ctx.stroke();
        }
      }
    }
    nodes.forEach(n=>{
      ctx.beginPath();ctx.arc(n.x,n.y,n.r,0,Math.PI*2);
      if(n.gold){ctx.fillStyle='rgba(196,163,90,.85)';ctx.shadowColor='rgba(196,163,90,.7)';}
      else{ctx.fillStyle='rgba(74,158,255,.9)';ctx.shadowColor='rgba(74,158,255,.8)';}
      ctx.shadowBlur=8;ctx.fill();ctx.shadowBlur=0;
      n.update();
    });
    requestAnimationFrame(drawNetwork);
  }
  drawNetwork();

  document.addEventListener('mousemove',e=>{mouseX=e.clientX;mouseY=e.clientY;});
}

// ═══════════════════════════════════════════
// CURSOR
// ═══════════════════════════════════════════
const curEl=document.getElementById('cursor');
const ringEl=document.getElementById('cursorRing');
if(curEl&&ringEl){
  let mx=0,my=0,rx=0,ry=0;
  document.addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;});
  document.addEventListener('mousedown',()=>curEl.classList.add('clicking'));
  document.addEventListener('mouseup',()=>curEl.classList.remove('clicking'));
  document.querySelectorAll('a,button,.contact-card,.role-pill,.core-plan,.testi-card').forEach(el=>{
    el.addEventListener('mouseenter',()=>ringEl.classList.add('hovered'));
    el.addEventListener('mouseleave',()=>ringEl.classList.remove('hovered'));
  });
  (function anim(){
    curEl.style.left=mx+'px';curEl.style.top=my+'px';
    rx+=(mx-rx)*.12;ry+=(my-ry)*.12;
    ringEl.style.left=rx+'px';ringEl.style.top=ry+'px';
    requestAnimationFrame(anim);
  })();
}

// ═══════════════════════════════════════════
// NAV SCROLL + PROGRESS BAR
// ═══════════════════════════════════════════
const nav=document.getElementById('mainNav');
const pb=document.getElementById('progress-bar');
function onScroll(){
  const s=window.scrollY;
  const dH=document.documentElement.scrollHeight-window.innerHeight;
  if(pb) pb.style.width=(s/dH*100)+'%';
  if(nav) nav.classList.toggle('scrolled',s>80);
  revealAll();
}
window.addEventListener('scroll',onScroll,{passive:true});

// ═══════════════════════════════════════════
// SCROLL REVEAL
// ═══════════════════════════════════════════
function revealAll(){
  document.querySelectorAll('.reveal,.reveal-l,.reveal-r,.reveal-s').forEach(el=>{
    if(el.getBoundingClientRect().top < window.innerHeight*.88) el.classList.add('in');
  });
}
revealAll();
window.addEventListener('load',revealAll);

// ═══════════════════════════════════════════
// PAGE TRANSITIONS
// ═══════════════════════════════════════════
const veil=document.getElementById('page-veil');
if(veil){
  // Fade in on load
  veil.classList.remove('show');

  // Intercept internal links
  document.querySelectorAll('a[href]').forEach(a=>{
    const href=a.getAttribute('href');
    if(!href||href.startsWith('#')||href.startsWith('mailto')||href.startsWith('tel')||href.startsWith('http')) return;
    a.addEventListener('click',e=>{
      e.preventDefault();
      veil.classList.add('show');
      setTimeout(()=>window.location.href=href,520);
    });
  });
}

// ═══════════════════════════════════════════
// ROLE PILLS (join form)
// ═══════════════════════════════════════════
let selectedRole='';
document.querySelectorAll('.role-pill').forEach(pill=>{
  pill.addEventListener('click',()=>{
    document.querySelectorAll('.role-pill').forEach(p=>p.classList.remove('active'));
    pill.classList.add('active');
    selectedRole=pill.dataset.role;
  });
});

// Shake keyframe
const st=document.createElement('style');
st.textContent=`@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-7px)}40%,80%{transform:translateX(7px)}}`;
document.head.appendChild(st);
