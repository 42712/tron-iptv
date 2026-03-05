```javascript
let server,user,pass

const grid=document.getElementById("grid")
const video=document.getElementById("video")

function togglePass(){

let p=document.getElementById("pass")

p.type=p.type==="password"?"text":"password"

}

function login(){

server=document.getElementById("server").value
user=document.getElementById("user").value
pass=document.getElementById("pass").value

document.getElementById("login").style.display="none"
document.getElementById("app").style.display="block"

live()

}

function play(url){

if(Hls.isSupported()){

let hls=new Hls()

hls.loadSource(url)

hls.attachMedia(video)

hls.on(Hls.Events.ERROR,function(){

setTimeout(()=>play(url),3000)

})

}else{

video.src=url

}

}

function clear(){

grid.innerHTML=""

}

function card(name,url,img){

let div=document.createElement("div")

div.className="card"

div.innerHTML=`

<img src="${img || "https://via.placeholder.com/300x400"}">

<p>${name}</p>

<button class="fav">⭐</button>

`

div.onclick=()=>play(url)

div.querySelector(".fav").onclick=(e)=>{

e.stopPropagation()

saveFav(name,url,img)

}

grid.appendChild(div)

}

function saveFav(name,url,img){

let fav=JSON.parse(localStorage.getItem("fav")||"[]")

fav.push({name,url,img})

localStorage.setItem("fav",JSON.stringify(fav))

alert("Adicionado aos favoritos")

}

function favorites(){

clear()

let fav=JSON.parse(localStorage.getItem("fav")||"[]")

fav.forEach(f=>card(f.name,f.url,f.img))

}

function api(action){

return `https://corsproxy.io/?${server}/player_api.php?username=${user}&password=${pass}&action=${action}`

}

function live(){

clear()

fetch(api("get_live_streams"))

.then(r=>r.json())

.then(data=>{

data.forEach(c=>{

let url=`${server}/live/${user}/${pass}/${c.stream_id}.m3u8`

card(c.name,url,c.stream_icon)

})

})

}

function movies(){

clear()

fetch(api("get_vod_streams"))

.then(r=>r.json())

.then(data=>{

data.forEach(m=>{

let url=`${server}/movie/${user}/${pass}/${m.stream_id}.mp4`

card(m.name,url,m.stream_icon)

})

})

}

function series(){

clear()

fetch(api("get_series"))

.then(r=>r.json())

.then(data=>{

data.forEach(s=>{

let div=document.createElement("div")

div.className="card"

div.innerHTML=`

<img src="${s.cover || "https://via.placeholder.com/300x400"}">

<p>${s.name}</p>

`

grid.appendChild(div)

})

})

}

function search(){

let q=document.getElementById("search").value.toLowerCase()

document.querySelectorAll(".card").forEach(c=>{

c.style.display=c.innerText.toLowerCase().includes(q)?"block":"none"

})

}

if("serviceWorker" in navigator){

navigator.serviceWorker.register("sw.js")

}
```
