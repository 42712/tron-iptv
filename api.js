```javascript
let server=""
let username=""
let password=""

function login(){

server=document.getElementById("server").value
username=document.getElementById("user").value
password=document.getElementById("pass").value

document.getElementById("loginBox").style.display="none"
document.getElementById("app").style.display="block"

loadLive()

}

function clearList(){

document.getElementById("list").innerHTML=""

}

function createCard(name,url,poster){

const card=document.createElement("div")

card.className="card"

card.onclick=()=>play(url)

card.innerHTML=`
<img src="${poster || 'https://via.placeholder.com/300x450'}">
<p>${name}</p>
`

document.getElementById("list").appendChild(card)

}

function loadLive(){

clearList()

fetch(`${server}/player_api.php?username=${username}&password=${password}&action=get_live_streams`)
.then(r=>r.json())
.then(data=>{

data.forEach(c=>{

let url=`${server}/live/${username}/${password}/${c.stream_id}.m3u8`

createCard(c.name,url)

})

})

}

function loadMovies(){

clearList()

fetch(`${server}/player_api.php?username=${username}&password=${password}&action=get_vod_streams`)
.then(r=>r.json())
.then(data=>{

data.forEach(m=>{

let url=`${server}/movie/${username}/${password}/${m.stream_id}.mp4`

createCard(m.name,url,m.stream_icon)

})

})

}

function loadSeries(){

clearList()

fetch(`${server}/player_api.php?username=${username}&password=${password}&action=get_series`)
.then(r=>r.json())
.then(data=>{

data.forEach(s=>{

const card=document.createElement("div")

card.className="card"

card.innerHTML=`<p>${s.name}</p>`

document.getElementById("list").appendChild(card)

})

})

}
```
