// Scans assets/music/ and writes assets/library.auto.json  (no dependencies)
//
//  assets/music/<Artist Name>/
//      photo.jpg|jpeg|png|webp        (artist photo)
//      artist.json                    (optional: {"name":"..","description":".."})
//      singles/Song Name.mp3          (+ optional Song Name.jpg as its cover)
//      albums/<Album Name>/cover.jpg  (album cover)
//      albums/<Album Name>/01 Track.mp3 ...   (sorted by file name)
//      albums/<Album Name>/tracks.json (optional, overrides the automatic names:
//                                       {"01 Track.mp3":{"title":"..","artist":".."}})
//
// Track names are cleaned automatically: numbers, site tags like (BandMusic) or
// mahanmusic.net, "Artist - " prefixes and "ft." credits are removed/moved.
const fs=require("fs"),path=require("path");
const ROOT=path.join(__dirname,"..","assets"),MUSIC=path.join(ROOT,"music");
const AUD=/\.(mp3|m4a|ogg|wav|flac)$/i,IMG=/\.(jpe?g|png|webp)$/i;
const rel=p=>path.relative(ROOT,p).split(path.sep).join("/");
const ls=d=>fs.existsSync(d)?fs.readdirSync(d,{withFileTypes:true}):[];
const natural=(a,b)=>a.localeCompare(b,undefined,{numeric:true});
const read=f=>fs.existsSync(f)?JSON.parse(fs.readFileSync(f,"utf8")):{};
const findImg=(dir,base)=>{const f=ls(dir).map(e=>e.name).find(n=>IMG.test(n)&&path.parse(n).name.toLowerCase()===base.toLowerCase());return f?rel(path.join(dir,f)):null};

const norm=s=>s.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g,"");
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
const JUNK=/\b(bandmusic|band music|mahan ?music|aria ?music|radio ?javan|download|official|audio|lyrics?|music video|video|hd|hq|\d{2,3} ?kbps|128|192|256|320|www)\b/i;

function parseName(file,artist,numbered,album){
  let s=file.replace(AUD,"").replace(/_+/g," ");
  s=s.replace(/[\s\-–_]*\b(?:www\.)?[a-z0-9]+\.(?:com|net|ir|org|info|me|ws|biz|co)\b/gi,"");   // site names
  s=s.replace(/[\(\[][^\)\]]*[\)\]]/g,m=>JUNK.test(m)?"":m);                                    // (BandMusic) etc.
  s=s.replace(/[\s\-–]*\b(?:128|192|256|320)\s*(?:kbps)?\s*$/i,"").replace(/\s+/g," ").trim();
  const num=numbered?/^\d{1,3}(?:\s*[-–)]\s*|\.(?=\D)\s*|\s+)/:/^0\d{1,2}(?:\s*[-–)]\s*|\.(?=\D)\s*|\s+)/;
  s=s.replace(num,"");                                                                           // track number
  const feat=[];
  s=s.replace(/\s*[\(\[]\s*(?:ft|feat|featuring)\b\.?\s*([^\)\]]+)[\)\]]/gi,(_,x)=>{feat.push(x);return ""});
  s=s.replace(/\s+(?:ft|feat|featuring)\b\.?\s+(.+)$/i,(_,x)=>{feat.push(x);return ""});
  const na=norm(artist),parts=s.split(/\s*[-–—]\s*/).filter(Boolean);
  if(parts.length>1){                                                                            // "Artist - Title"
    const hit=(f)=>parts.findIndex(p=>{const n=norm(p);return n&&f(n)});
    const ai=[hit(n=>n===na),hit(n=>na.length>3&&n.includes(na))].find(i=>i>=0)??-1;
    if(ai>=0){
      const rest=parts.filter((_,i)=>i!==ai),ti=ai===0?rest.length-1:0;
      s=rest[ti];rest.forEach((p,i)=>{if(i!==ti)feat.push(p)});
    }
  }
  if(album){const r=new RegExp("^"+esc(album)+"\\s*[-–:]?\\s*","i"),t=s.replace(r,"");if(t)s=t.replace(num,"").replace(/^\((.*)\)$/,"$1")}
  if(!/\s/.test(s)&&s===s.toLowerCase())s=s.split(/[-_]+/).map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");
  s=s.replace(/\s+/g," ").replace(/^[-–\s]+|[-–\s]+$/g,"")||file.replace(AUD,"");
  const f=[...new Set(feat.join(", ").replace(/\s+x\s+/gi,", ").split(/\s*,\s*|\s*&\s*/).map(x=>x.trim()).filter(x=>x&&norm(x)!==na))];
  return{title:s,artist:f.length?artist+" feat. "+f.join(", "):artist};
}

function main(){
  const artists=[];
  for(const d of ls(MUSIC).filter(e=>e.isDirectory()).sort((a,b)=>natural(a.name,b.name))){
    const dir=path.join(MUSIC,d.name),meta=read(path.join(dir,"artist.json"));
    const name=meta.name||d.name;
    const singles=ls(path.join(dir,"singles")).map(e=>e.name).filter(n=>AUD.test(n)).sort(natural).map(n=>{
      const p=parseName(n,name,false);
      return{title:p.title,artist:p.artist,cover:findImg(path.join(dir,"singles"),path.parse(n).name),audio:rel(path.join(dir,"singles",n))}});
    const albums=ls(path.join(dir,"albums")).filter(e=>e.isDirectory()).sort((a,b)=>natural(a.name,b.name)).map(a=>{
      const ad=path.join(dir,"albums",a.name),tm=read(path.join(ad,"tracks.json"));
      return{title:a.name,cover:findImg(ad,"cover"),tracks:ls(ad).map(e=>e.name).filter(n=>AUD.test(n)).sort(natural).map(n=>{
        const p=parseName(n,name,true,a.name);
        return{title:(tm[n]&&tm[n].title)||p.title,artist:(tm[n]&&tm[n].artist)||p.artist,audio:rel(path.join(ad,n))}})};
    });
    artists.push({name,photo:findImg(dir,"photo"),description:meta.description||"ARTIST",singles,albums});
  }
  fs.writeFileSync(path.join(ROOT,"library.auto.json"),JSON.stringify({artists},null,1));
  console.log("library.auto.json:",artists.length,"artists");
}
if(require.main===module)main();
module.exports={parseName};
