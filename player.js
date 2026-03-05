```javascript
const video = document.getElementById("video")

function play(url){

if(Hls.isSupported()){

const hls=new Hls()

hls.loadSource(url)

hls.attachMedia(video)

}else{

video.src=url

}

}

function togglePassword(){

let p=document.getElementById("pass")

if(p.type==="password"){
p.type="text"
}else{
p.type="password"
}

}

function searchItem(){

let input=document.getElementById("search").value.toLowerCase()

let cards=document.querySelectorAll(".card")

cards.forEach(card=>{

if(card.innerText.toLowerCase().includes(input)){

card.style.display="block"

}else{

card.style.display="none"

}

})

}
```
