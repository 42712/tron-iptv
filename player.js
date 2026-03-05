const video = document.getElementById("video")

function play(url){

if(Hls.isSupported()){

const hls = new Hls()
hls.loadSource(url)
hls.attachMedia(video)

}else{

video.src = url

}

}

function addItem(name,url){

const item = document.createElement("div")
item.className="item"
item.innerText=name

item.onclick=()=>play(url)

document.getElementById("list").appendChild(item)

}
