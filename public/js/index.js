window.addEventListener("DOMContentLoaded", function () {
	var emoji = new EmojiConvertor();

	for (var i in emoji.img_sets) {
		emoji.img_sets[i].path = 'https://github.com/iamcal/emoji-data/tree/master/img-' + i + '-64/';//'/emoji-data/img-'+i+'-64/';
		emoji.img_sets[i].sheet = '/images/sheet_' + i + '_64.png';
	}

	emoji.use_sheet = true;

	emoji.init_env();
	var auto_mode = emoji.replace_mode;
	//  = "Detected replace mode : "+emoji.replace_mode;
	// document.getElementById('data').innerHTML = emoji.replace_colons(document.getElementById('data').innerHTML);
	go();

	function go() {

		emoji.img_set = 'apple';
		emoji.replace_mode = auto_mode;
		emoji.text_mode = false;

		var react_cards = document.getElementsByClassName('react-emoji-count'); // reacts for each post
		for (var i = 0; i < react_cards.length; i++) {
			react_cards[i].innerHTML = emoji.replace_colons(react_cards[i].innerHTML);
		}
	}
	$('table').tablesort();
});
