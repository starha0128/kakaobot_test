import {Long, TalkOpenChannel} from 'node-kakao';
import request from 'request';

const fs = require("fs");

function setInitialValue(data, channel){    //chinfo 방 입장 시 초기값 생성
    let channelId = String(channel.info.channelId);

    if(!data[channelId]){
        data[channelId] = {
            "chTitle" : channel.getDisplayName(),
            "endDate" : "2021-12-31",
            "scanChatType" : ["1", "2", "12", "20", "26", "27"],
            "isMoniter" : false,
            "key" : 1,
            "deportFlag" : true,
            "wList" : []
        }
        fs.writeFileSync('./json/chInfo.json', JSON.stringify(data));
    }
}

// function isUserManager(data){

// }

function updateData(path){  //JSON 값 업데이트
    var dataBuf1 = fs.readFileSync(path);
    var dataJSON1 = dataBuf1.toString();
    var upData = JSON.parse(dataJSON1)

    return upData
}

function userChatListHide(channel, userInfo){   //특정유저 챗리스트 삭제
    const openchannel = channel as TalkOpenChannel;
    let channelId = String(channel.info.channelId);

    try {
        let chatList = updateData(`./json/channel/${channelId}.json`);
        let userId = String(userInfo.userId)
        let userChat = chatList["userChatList"][userId]["chatLog"]
        let chatType = chatList["userChatList"][userId]["chatType"]
        console.log(`${userChat.length}개 도배 채팅 가리기`)
        // console.log(chatType)

        for(let i=0; i<userChat.length; i++){
            (function(x){
                setTimeout(function(){
                    openchannel.hideChat({"logId": userChat[i] as Long, "type": Number(chatType[i])})
                }, 175*x);
            })(i);
        }

        delete chatList["userChatList"][userId]
        fs.writeFileSync(`./json/channel/${channelId}.json`, JSON.stringify(chatList));
    } catch (error) {
        console.log("채팅내역 없음")
    }
}

function chatTypeChk(array, chatType, data){  //chinfo[channelId].scanChatType 값과 대조 일치할 시 false반환
    if(chatType==71){
        var chatSID = data.attachment()['P'].SID
        console.log(chatSID)
        if(chatSID=="gift")return false;
    }
    if(array.some(e=>chatType==e))return false;
    
    // for(var i=0; i<array.length; i++){
    //     if(chatType==array[i])return false;
    // }

    return true;
}

function chatWordChk(text, keyArr){    //키워드 감지
    text = text.replace(/ /g,"");
    // if(keyArr.some(s => text.indexOf(s) > -1))return true;
    for (const key of keyArr){
        if (text.indexOf(key) > -1){
            console.log(`※감지 키워드※ : [${key}]`)
            return key;
        }
    }
    return keyArr.find(s => text.indexOf(s) > -1);
}

async function attachmentChk(data, keyArr){
    if(data.attachment()['path']){
        let pathURL = "http://dn-m.talk.kakao.com"+data.attachment()['path']
        console.log(pathURL)
        if(data.chat.type==1){
            var res = await request(pathURL, (error, response, body)=>{
                if(error) throw error;

                console.log(body)
                let chkResult = chatWordChk(body, keyArr)
                
                console.log(chkResult)

                return chkResult
            })
        }
    }
    else return false
}



function hideChatDelay(data, channel, delay){  //일괄 hideChat()딜레이
    const openchannel = channel as TalkOpenChannel;
    setInterval(()=>{
        openchannel.hideChat({"logId": data.chat.logId as Long, "type": data.chat.type as number})
    }, delay);
}

function isDeport(data, channel){   //해당 방 모니터링 여부 파악
    let channelId = String(channel.info.channelId);
    let flag = data[channelId].deportFlag;

    return flag
}

function isMonitering(data, channel){   //해당 방 모니터링 여부 파악
    let channelId = String(channel.info.channelId);
    let flag = data[channelId].isMoniter;

    return flag
}

function isOpenChat(channel) { //오픈채팅방 여부 파악
    if (channel.info.type == 'OM' || channel.info.type == 'OD') return 1;
    else return 0;
}

function wlAdd(data, channel, json){
    let channelId = String(channel.info.channelId);

    data.mentions.map(v=>{
        var mentionUserInfo = channel.getUserInfo({"userId":v.user_id as Long});

        json[channelId]["wList"][String(mentionUserInfo.userId)] = mentionUserInfo.nickname;
    })
    // json[channelId]["wList"] = Array.from(new Set(json[channelId]["wList"]));
    let temp = json
    console.log(temp)
    fs.writeFileSync('./json/chInfo.json', JSON.stringify(temp));
    console.log(temp)
    // fs.writeFileSync('./json/chInfo.json', JSON.stringify(json));
    
}

function isFileExist(channelId){
    try {
        // console.log(channelId)
        if(fs.statSync(`./json/channel/${channelId}.json`))return true;
        else return false;
    } catch (error) {
        console.log("파일 없음/생성");
        return false;
    }
    
}

function pathName(data, channel, logName){    //저장파일 이름 지정
    var chatType=data.chat.type;
    let chName=channel.getDisplayName();
    var reg = /\//gi
    if(reg.test(chName)){
        chName = chName.replace(reg,"");
    }
    
    if(chatType!=1){
        var path = './log/['+chName+"]"+logName+'custom.txt';
    }
    else{
        var path = './log/['+chName+"]"+logName+'txt';
    }
    return path;
}

function saveLog(data, channel, now){    //로그 저장
    var logName = now.toLocaleDateString();
    var path = pathName(data, channel, logName); //파일명 설정
    var logDate = now.toLocaleDateString()+" "+now.getHours()+":"+now.getMinutes();
    var chatType = data.chat.type;
    let chName=channel.getDisplayName();
    try{
        var memberNick = String(data.getSenderInfo(channel).nickname);    //가끔 내보내진 사람들한테 정보가져오려고 해서 오류나서 추가한거
    }catch(err){
        console.log("※오류 - 유저 닉네임");
        var memberNick = "undefined";
    }

    let logTxt="-일시 : "+logDate+"\n-채널명 : "+chName+"\n-멤버명 : "+memberNick+"\n-챗타입 : " +chatType+"\n-채팅내용 :\n" + String(data.text) + "\n\n\n";

    fs.open(path,'a+',function(err,fd){
        if(err) throw err;
        if(fd == '9'){
            console.log('file create.');
        }else{
            fs.readFile(path, 'utf8', function(err, data) {
            });
        }
    });
    fs.appendFile(path, logTxt, (err)=>{
        if(err) throw err;
    })
    return;
}

export {updateData, chatTypeChk, chatWordChk, hideChatDelay, setInitialValue, isMonitering, isOpenChat, wlAdd, isFileExist, isDeport, userChatListHide, saveLog, attachmentChk}