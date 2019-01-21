var Jaccard = require("jaccard-index");
module.exports = function (logs) {
    var module = {};
    // var logs = {
    //   "item1": ["user1", "user2"],
    //   "item2": ["user2", "user3", "user4"],
    //   "item3": ["user1", "user2", "user5"]
    // };

    var items = Object.keys(logs); // item1, item2, item3

    var options = {
        getLog: getLog
    };
    links = Jaccard(options).getLinks(items);

    function getLog(item) {
        return Promise.resolve(logs[item]); // async loading
        // return logs[item]; // sync loading

        //   return new Promise(function(resolve, reject) {
        //     var file = "test/example/" + item + ".txt";
        //     fs.readFile(file, "utf-8", function(err, text) {
        //       if (err) return reject(err);
        //       var list = text.split("\n").filter(function(v) {
        //         return !!v;
        //       });
        //       return resolve(list);
        //     });
        //   });
    }

    module.JaccardIdx = JSON.stringify(links, null, 2);
    return module;
};
