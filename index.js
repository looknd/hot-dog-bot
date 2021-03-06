// HEROKU安装配置：Heroku是一个支持多种编程语言的云平台即服务。
var express = require("express");
var app = express();

// 引入AWS依赖，并配置使用区域
var AWS = require('aws-sdk');
AWS.config.update({region: 'us-east-1'});

// 实例化
var rekognition = new AWS.Rekognition();

var request = require('request').defaults({ encoding: null });
app.get('/', function(req, res){ res.send('The robot is happily running.'); });
app.listen(process.env.PORT || 5000);


// 机器人List 配置
var config = {
    me: 'IsItAHotdog', // 认证的账号，进行retweet.
    regexFilter: '', // 只接受符合正则匹配完成的推文.
    regexReject: '', // 拒绝不符合模式的推文.

    keys: {
        consumer_key: process.env.TWITTER_CONSUMER_KEY,
        consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
        access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
        access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
    },
};

// retweet逻辑
function onReTweet(err) {
    if(err) {
        console.error("retweeting failed :(");
        console.error(err);
    }
}

function tweetBasedOnCategorization(tweet, isItAHotdog) {
    var message = " This is NOT a hotdog";
    if(isItAHotdog) {
        message = " This is a hotdog";
    }
    tu.update({
        status: "@" + tweet.user.screen_name + message,
        in_reply_to_status_id: tweet.id_str
    }, onReTweet);
}

// 对单条推文的操作.
function onTweet(tweet) {
    // 如果满足以下条件，则拒绝:
    //  1. 本身就是一条retweet
    //  2. 匹配我们拒绝正则模式
    //  3. 不匹配我们的接受正则模式
    var regexReject = new RegExp(config.regexReject, 'i');
    var regexFilter = new RegExp(config.regexFilter, 'i');
    if (tweet.retweeted) {
        return;
    }
    if (config.regexReject !== '' && regexReject.test(tweet.text)) {
        return;
    }
    if (regexFilter.test(tweet.text)) {
        console.log(tweet);
        var has_image = false;
        var image_url = '';
        if(tweet.entities.hasOwnProperty('media') && tweet.entities.media.length > 0) {
            has_image = true;
            image_url = tweet.entities.media[0]['media_url'];
        } else if (tweet.hasOwnProperty('extended_tweet')) {
            if(tweet.extended_tweet.entities.hasOwnProperty('media') && tweet.extended_tweet.entities.media.length > 0) {
                has_image = true;
                image_url = tweet.extended_tweet.entities.media[0]['media_url'];
            }
        }
        if(has_image) {
            request.get(image_url, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    var params = {
                        Image: { 
                            Bytes: body
                        },
                        MaxLabels: 20,
                        MinConfidence: 70
                    };
                    rekognition.detectLabels(params, function(err, data) {
                        if (err) console.log(err, err.stack);
                        else {
                            console.log(data);
                            var isItAHotdog = false;
                            for (var label_index in data.Labels) {
                                var label = data.Labels[label_index];
                                if(label['Name'] == "Hot Dog") {
                                   if(label['Confidence'] > 85) {
                                        isItAHotdog = true;
                                        tweetBasedOnCategorization(tweet, true);
                                    }
                                }
                            }
                            if(isItAHotdog == false) {
                                tweetBasedOnCategorization(tweet, false);
                            }
                        }
                    });
                }
            });
        } else {
            console.log("Tweet did not have an image")
        }
        
    }
}

// 监听twitter流，并且作出响应.
function listen() {
    tu.filter({
        track: 'isitahotdog'
    }, function(stream) {
        console.log("listening to stream");
        stream.on('tweet', onTweet);
    });
}


var tu = require('tuiter')(config.keys);

listen();
