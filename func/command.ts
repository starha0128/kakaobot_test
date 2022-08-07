import { api, TalkClient, AuthApiClient, Long, TalkOpenChannel, OAuthApiClient, OpenChannelUserInfo } from 'node-kakao';

// import {} from 'node-kakao';
import { hideChatDelay, updateData } from './func';
import { email, pw, deviceName, deviceUUID} from '../account.json';

// const EMAIL = email;
// const PASSWORD = pw;
// const DEVICE_NAME = deviceName;
const DEVICE_UUID = deviceUUID;

const request = require('request-promise-native').defaults({jar: true});

const fs = require("fs");

const mentionUserList = function(data, channel){
    let mentionUser = data.mentions.map(v=>{
        var mentionUserInfo = channel.getUserInfo({"userId":v.user_id as Long});
        var mentionUserObj = {userId : String(mentionUserInfo.userId), userName : mentionUserInfo.nickname}
        return mentionUserObj
    })
    return mentionUser;
}

function wlAdd(data, channel, json){    //화이트리스트 추가 부분
    hideChatDelay(data, channel, 125);  //딜레이 삭제처리

    let channelId = String(channel.info.channelId);
    let channelWl = json[channelId]["wList"];
    let mentionUser = mentionUserList(data, channel);
    
    mentionUser.map(x=>{                //./json/chInfo.js 에 멘션유저 배열 추가
        if(!channelWl.some(y=>x.userId==y.userId)){
            json[channelId]["wList"].push(x);
        }
    })

    fs.writeFileSync('./json/chInfo.json', JSON.stringify(json));
}

function keyAdd(data, channel, bankey, chInfo){
    hideChatDelay(data, channel, 125);  //딜레이 삭제처리

    bankey[chInfo[String(channel.info.channelId)].key].push(data.text.substr(9));

    bankey[chInfo[String(channel.info.channelId)].key] = Array.from(new Set(bankey[chInfo[String(channel.info.channelId)].key]))

    fs.writeFileSync('./json/banKey.json', JSON.stringify(bankey));
}

// function addKeyList(chat, keyWord, num){       //스팸 키워드 추가(하나씩)
//     keyWord[num].push(chat.Text.substr(4));

//     keyWord[num] = Array.from(new Set(keyWord[num]));
//     // console.log(keyWord["1"]);

//     fs.writeFileSync('./json/banKey.json', JSON.stringify(keyWord));
// }

async function checkKorean(data, channel){
    let channelId = channel.info.channelId;
    let userId = data.mentions[0].user_id;

    // const session_info = accesstoken;
    // console.log(accesstoken.toString())
    //getLoginData 부분 loginRes.result값에서 "accesstoken-deviceUUID" 양식
    
    const isK = await isKorean(channelId, userId);
    console.log(isK)
    
    return isK;
}

async function joincheckKorean(user, channel){
    let channelId = channel.info.channelId;

    // const session_info = accesstoken;
    //getLoginData 부분 loginRes.result값에서 "accesstoken-deviceUUID" 양식
    
    const isK = await isKorean(channelId, user);
    
    return isK;
}

// async function getLoginData(): Promise<api.LoginData> {
//     const api = await AuthApiClient.create(DEVICE_NAME, DEVICE_UUID);
//     const loginRes = await api.login({
//         email: EMAIL,
//         password: PASSWORD,
//         // forced: true,
//     });
//     if (!loginRes.success) throw new Error(`Web login failed with status: ${loginRes.status}`);
//     console.log(loginRes)
//     return loginRes.result;
// }



async function isKorean(channelId, userId){
    let accountInfo = updateData("./account.json")

    const ACCESS_TOKEN = accountInfo['accessToken'] as string;
    const REFRESH_TOKEN = accountInfo['refreshToken'] as string;
    const USER_ID = Long.fromValue(accountInfo['userId'] as string);

    const oAuthClient = await OAuthApiClient.create()
    const newTokenRes = await oAuthClient.renew({
        userId: USER_ID,
        deviceUUID: DEVICE_UUID,
        accessToken: ACCESS_TOKEN,
        refreshToken: REFRESH_TOKEN
    });
    if (!newTokenRes.success) throw new Error(`Cannot renew oauth token: ${newTokenRes.status}`);

    const res = newTokenRes.result;

    console.log("토큰값 재설정")

    const session_info = `${res.credential.accessToken}-${res.credential.deviceUUID}`
    
    // const loginRes = await getLoginData()

    // const session_info = `${loginRes.accessToken}-${loginRes.deviceUUID}`

    // console.log(`session_info : ${session_info}`)

    try {
        await request({
            uri: "https://gift-talk.kakao.com",
            method: "POST",
            form: {
                "x-kc-adid": "00000000-0000-0000-0000-000000000000",
                "agent": "aW9zLjE0LjcuMTo5LjQuNzoxMTI1eDI0MzY6aVBob25lOmlvcy4xNC43LjE%3D",
                "session_info": session_info,
                "chat_id": channelId?.toString(),
                "billingReferer": "talk_chatroom_plusbtn",
                "input_channel_id": "1926"
            },
            followAllRedirects: true,
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 9.4.7',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            resolveWithFullResponse: true
        });
        const response = await request(
            {
                uri: "https://gift.kakao.com/a/v2/session/receivers",
                method: "POST",
                json: [{"serviceUserId": userId?.toString()}]
            }
        );
        return response.validReceivers.length > 0
    } catch (e) {
        console.log(e)
        // 오류났을경우 혹시 모르니 일단 한국인인걸로..
        return true
    }

}

async function chatListGet(channel, startLogId){
    const openchannel = channel as TalkOpenChannel;

    const chatList = await openchannel.getChatListFrom(startLogId)
    // console.log(chatList)
    if (!chatList.success) throw new Error(`error : ${chatList.status}`);

    return chatList.result
}

async function repleyChatHide(channel, startLogId, allChatList, allChatType){
    // const openchannel = channel as TalkOpenChannel;
    const chatList = await chatListGet(channel, startLogId as Long)
    // console.log(chatList.length)
    let endLogId = chatList[chatList.length-1]

    let list = chatList.map(
        (v)=>{
            let userPerm = channel.getUserInfo(v.sender) as OpenChannelUserInfo;
            let adminPerm = [1, 4, 8]

            if(v.type!=13 && !adminPerm.some(v=>{return v==userPerm.perm})){
                // setTimeout(()=>{
                //     // openchannel.hideChat({"logId": v.logId as Long, "type": v.type})
                    
                // }, 150*index)
                
                allChatList.push(v.logId)
                allChatType.push(v.type)
            }
        }
    );
    
    // console.log(chatList.length)

    if(chatList.length>=100){
        return await repleyChatHide(channel, endLogId.logId, allChatList, allChatType)
    }
    else{
        // console.log(allChatList.length)
        // console.log(allChatType.length)
        
        return [allChatList, allChatType];
    }
}

function wlDel(data, channel, json){    //화이트리스트 삭제
    hideChatDelay(data, channel, 125);

    let channelId = String(channel.info.channelId);
    let channelWl = json[channelId]["wList"];
    let mentionUser = mentionUserList(data, channel);
    var idx=[];                         //인덱스 선언

    channelWl.map(x=>{
        if(mentionUser.some(y=>y.userId==x.userId)){
            idx.push(channelWl.indexOf(x))
        }
    })
    
    idx.reverse().map(x=>{              //배열 인덱스 값 리버스 및 인덱스값 삭제
        json[channelId]["wList"].splice(x,1);
    })

    fs.writeFileSync('./json/chInfo.json', JSON.stringify(json));
}

function wlReset(data, channel, json){      //화이트리스트 초기화
    hideChatDelay(data, channel, 125);

    let channelId = String(channel.info.channelId);
    json[channelId]["wList"]=[];

    fs.writeFileSync('./json/chInfo.json', JSON.stringify(json));
}

export {wlAdd, wlDel, wlReset, checkKorean, joincheckKorean, chatListGet, repleyChatHide, keyAdd};