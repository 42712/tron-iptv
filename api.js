```javascript
let server=""
let username=""
let password=""

function login(){

server=document.getElementById("server").value
username=document.getElementById("user").value
password=document.getElementById("pass").value

document.getElementById("login").style.display="none"
document.getElementById("app").style.display="block"

loadLive()

}

function loadLive(){

clearList()

fetch(`${server}/player_api.php?username=${username}&password=${password}&action=get_live_streams`)
.then(r=>r.json())
.then(data=>{

data.forEach(ch=>{

let url=`${server}/live/${username}/${password}/${ch.stream_id}.m3u8`

addItem(ch.name,url)

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

addItem(m.name,url)

})

})

}

function loadSeries(){

clearList()

fetch(`${server}/player_api.php?username=${username}&password=${password}&action=get_series`)
.then(r=>r.json())
.then(data=>{

data.forEach(s=>{

let item=document.createElement("div")

item.className="item"

item.innerText=s.name

document.getElementById("list").appendChild(item)

})

})

}
```
