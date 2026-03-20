const canvas = document.getElementById("particleCanvas");
const ctx = canvas && canvas.getContext ? canvas.getContext("2d") : null;

if (canvas && ctx) {
  canvas.width = 300;
  canvas.height = 300;
}

let particles = [];
let logoPoints = [];

class Particle{
  constructor(x,y){
    this.x = Math.random()*300;
    this.y = Math.random()*300;
    this.tx = x;
    this.ty = y;
    this.size = 2;
  }
  update(){ this.x += (this.tx - this.x)*0.06; this.y += (this.ty - this.y)*0.06; }
  draw(){ ctx.fillStyle="#4f7cff"; ctx.beginPath(); ctx.arc(this.x,this.y,this.size,0,Math.PI*2); ctx.fill(); }
}

function createLogoPoints(){
  const img = new Image();
  img.src = "/ndovera.png";
  img.crossOrigin = 'anonymous';
  img.onload = function(){
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    tempCanvas.width = 300; tempCanvas.height = 300;
    tempCtx.drawImage(img,50,50,200,200);
    const data = tempCtx.getImageData(0,0,300,300).data;
    for(let y=0;y<300;y+=6){
      for(let x=0;x<300;x+=6){
        const index = (y*300 + x)*4;
        if(data[index+3] > 150){ logoPoints.push({x,y}); }
      }
    }
    logoPoints.forEach(p=>{ particles.push(new Particle(p.x,p.y)); });
  }
}

function animate(){ if (!ctx) return; ctx.clearRect(0,0,canvas.width,canvas.height); particles.forEach(p=>{ p.update(); p.draw(); }); requestAnimationFrame(animate); }

createLogoPoints();
animate();

/* Logo glow */
setTimeout(()=>{
  const logo = document.getElementById("logo");
  if(logo){ logo.style.opacity = "1"; logo.classList.add("logo-glow"); }
},3000);

/* Energy ring */
setTimeout(()=>{
  const ring = document.querySelector(".energy-ring");
  if(ring){ ring.style.opacity = "1"; ring.classList.add("ring-spin"); }
},4200);

/* Fade to dashboard / reveal app root */
setTimeout(()=>{
  const loader = document.getElementById("ndovera-loader");
  if(loader){ loader.style.opacity = "0"; loader.style.transition = 'opacity 0.8s ease'; }
  const root = document.getElementById("root");
  if(root){ setTimeout(()=>{ loader && loader.remove(); },900); }
},6500);
