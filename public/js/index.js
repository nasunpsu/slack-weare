var emoji = new EmojiConvertor();

for (var i in emoji.img_sets){
	emoji.img_sets[i].path = 'https://github.com/iamcal/emoji-data/tree/master/img-'+i+'-64/';//'/emoji-data/img-'+i+'-64/';
	emoji.img_sets[i].sheet = '/images/sheet_'+i+'_64.png';
}

emoji.use_sheet = true;

emoji.init_env();
var auto_mode = emoji.replace_mode;
//  = "Detected replace mode : "+emoji.replace_mode;
// document.getElementById('data').innerHTML = emoji.replace_colons(document.getElementById('data').innerHTML);
go();

function go(){

	emoji.img_set = 'apple';
	emoji.replace_mode = auto_mode;
	emoji.text_mode = false;

    var react_cards = document.getElementsByClassName('react-emoji-count'); // reacts for each post
    for(var i = 0 ; i < react_cards.length; i++) {
        react_cards[i].innerHTML = emoji.replace_colons(react_cards[i].innerHTML);
    }
	// var out = emoji.replace_colons(text);

	// document.getElementById('out3').innerHTML = out;
	// document.getElementById('out4').innerText = out;
	// document.getElementById('out4').textContent = out;
}

// function go2(){
// 	var s = document.getElementById('mode');
// 	var mode = s.options[s.selectedIndex].value;

// 	emoji.img_set = 'apple';
// 	emoji.text_mode = mode == 'text';

// 	if (mode == 'css'){
// 		emoji.replace_mode = 'img';
// 		emoji.supports_css = true;
		
// 	}else if (mode == 'img'){
// 		emoji.replace_mode = 'img';
// 		emoji.supports_css = false;

// 	}else{
// 		emoji.replace_mode = mode;
// 	}

// 	document.getElementById('out2').innerHTML = emoji.replace_colons("hello :smile: world");
// 	return false;
// }

// function go3(){
// 	emoji.img_set = 'apple';
// 	emoji.replace_mode = auto_mode;
// 	emoji.text_mode = false;

// 	$("#jout1").emoji();	
// }

// function go4(){
// 	var s = document.getElementById('imgset');
// 	var imgset = s.options[s.selectedIndex].value;

// 	emoji.img_set = imgset;
// 	emoji.replace_mode = auto_mode;
// 	emoji.text_mode = false;

// 	document.getElementById('out5').innerHTML = emoji.replace_colons("hello :smile: world :flag-ca:");
// 	return false;
// }
