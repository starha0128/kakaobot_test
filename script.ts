import { api, AuthApiClient, ChatBuilder, Chatlog, CommandResultDone, KnownChatType, Long, MentionContent, ReplyAttachment, TalkClient, OpenLink, TalkOpenChannel, ChannelUserInfo, UserType, NormalChannelUserInfo, OpenChannelUserPerm, KnownDataStatusCode, OpenLinkChannelUserInfo, OpenChannelUserInfo, OpenLinkInfo, OpenLinkSettings, ChannelInfo, OpenLinkProfile, OpenChannelInfo} from 'node-kakao';
import { chat } from 'node-kakao/dist/packet';
import { structToOpenLink } from 'node-kakao/dist/packet/struct';
import request from 'request';

import { email, pw, deviceName, deviceUUID} from './account.json';
import { updateData, chatTypeChk, chatWordChk, hideChatDelay, setInitialValue, isMonitering, isOpenChat, isFileExist, isDeport, userChatListHide, saveLog, attachmentChk} from './func/func';
import { wlAdd, wlDel,  wlReset, checkKorean, joincheckKorean, chatListGet, repleyChatHide, keyAdd} from './func/command';


const fs = require("fs");

const DEVICE_UUID = deviceUUID;
const DEVICE_NAME = deviceName;

const EMAIL = email;
const PASSWORD = pw;

const channelJson = {
    userChatList : {
        userId : {
            chatLog : [],
            chatType : []
        }
    }
}

const check = {};

//--------------도배방지 설정 영역--------------//

const TIME_MILISEC = 3 * 1000; //X초 동안 ex) 3 * 1000(3초 동안)
const MSG_NUM = 5; //Y개의 메세지 < 5개의 메시지

//---------------------------------------------//

function isSpam(sender) {
    const time = Date.now();
    if (check[sender] === undefined) {
      check[sender] = {};
      check[sender].time = time;
      check[sender].count = 1;
      setTimeout(() => delete check[sender], TIME_MILISEC);
    } else check[sender].count++;
    return checkSpam(sender, time);
}
function checkSpam(sender, time) {
    if (
        check[sender].count >= MSG_NUM &&
        time - check[sender].time < TIME_MILISEC
    ) {
        return true;
    } else return false;
}

const CLIENT = new TalkClient();

CLIENT.on('switch_server', () => {
    login().then(() => {
        console.log('Server switched!');
    });
});

CLIENT.on('chat', async (data, channel) => {
    try {

        let channelId = String(channel.info.channelId);

        let chInfo = updateData("./json/chInfo.json");  //채널정보 가져오기
        // let banKey = updateData("./json/banKey.json");  //키워드 리스트 가져오기

        if(isOpenChat(channel)){
            const openchannel = channel as TalkOpenChannel;
            let userInfo = <OpenChannelUserInfo>data.getSenderInfo(channel)
            let userPerm = 2
            
            try {
                userPerm = userInfo.perm;
            } catch (error) {
                userPerm = 2
            }

            setInitialValue(chInfo, channel);   //초기값 설정

            if(isMonitering(chInfo, channel)){
                // console.log("ismonitoring")
                var wList = chInfo[channelId]["wList"].map(v=>{
                    var channelWList = v.userId;
                    return channelWList;
                })
                // if(userPerm===1 || userPerm===4 || userPerm===8 || wList.some(v=>v==String(userInfo.userId))){
                if(userPerm===1 || userPerm===4 || userPerm===8){
                    // console.log("isperm")
                    if (data.text.startsWith("!")) {
                        const command = data.text.slice(1);
                        if(command.startsWith("chk")){
                            const isK = await checkKorean(data, channel)
                            if(isK){
                                // try {
                                //     // openchannel.kickUser({userId : user.userId});
                                //     console.log("한국인")
                                // } catch (error) {
                                //     console.log(`선물에러 : ${error}`);
                                // }
                                channel.sendChat("한국계정입니다.")
                            }else{
                                channel.sendChat("해외계정입니다.")
                                return;
                            } 
                        }
                        
                        if(command.startsWith("hide") && data.chat.type==26){
                            // var channelName = channel.getDisplayName()
                            let chatListArr = [];
                            let chatTypeArr = [];
                            openchannel.hideChat({"logId": data.chat.logId as Long, "type": data.chat.type as number})

                            openchannel.hideChat({"logId": data.attachment<ReplyAttachment>().src_logId as Long, "type": data.attachment<ReplyAttachment>().src_type as number})

                            let [allChatList, allChatType] = await repleyChatHide(channel, data.attachment<ReplyAttachment>().src_logId as Long, chatListArr, chatTypeArr);

                            for(let i=0;  i<allChatList.length; i++){
                                (function(x){
                                    setTimeout(function(){
                                        // console.log(`logid : ${allChatList[i] as Long}\ntype : ${allChatType[i]}`)
                                        openchannel.hideChat({"logId": allChatList[i] as Long, "type": allChatType[i]})
                                    }, 175*x);
                                })(i);
                            }

                            // console.log(list);
                            return;
                        }
                    }
                    return;
                }
                // else{
                //     let banKey = updateData("./json/banKey.json");  //키워드 리스트 가져오기
                //     var banKeyArr = banKey[chInfo[channelId].key];

                //     if(data.chat.type==1 && data.attachment()['path']){
                //         let pathURL = "http://dn-m.talk.kakao.com"+data.attachment()['path']
                //         if(data.chat.type==1){
                //             var res = await request(pathURL, (error, response, body)=>{
                //                 if(error) throw error;

                //                 let chkResult = chatWordChk(body, banKeyArr)

                //                 let now = new Date();
                //                 saveLog(data, channel, now)

                //                 if(isDeport(chInfo, channel)){
                //                     console.log("유저 내보내기")
                //                     const openchannel = channel as TalkOpenChannel;
                //                     try {
                //                         openchannel.kickUser(userInfo);
                //                     } catch (error) {
                //                         console.log("※에러발생※userId오류")
                //                     }

                //                     userChatListHide(channel, userInfo)
                //                 }else{
                //                     hideChatDelay(data, channel, 125);
                //                 }
                //                 console.log("전체보기 유형 감지로 인한 가리기 처리")
                //                 return;
                //             })
                //         }
                //     }
                // }
                return;
            }
            return;
        }
        return;
    } catch (error) {
        console.log(error)
        return;
    }
});

CLIENT.on('chat', (data, channel) => {
    try {
        // const openchannel = channel as TalkOpenChannel;
        let channelId = String(channel.info.channelId);

        let chInfo = updateData("./json/chInfo.json");  //채널정보 가져오기
        let banKey = updateData("./json/banKey.json");  //키워드 리스트 가져오기
        // let accountInfo = updateData("./account.json");

        // let accessToken = accountInfo.accessTok


        if(isOpenChat(channel)){

            let userInfo = <OpenChannelUserInfo>data.getSenderInfo(channel)
            // let userPerm = userInfo.perm;

            let userPerm = 2
            
            try {
                userPerm = userInfo.perm;
            } catch (error) {
                userPerm = 2;
            }

            setInitialValue(chInfo, channel);   //초기값 설정

            // console.log("chatLogId : "+data.chat.logId);

            var chatTypeArr = chInfo[channelId].scanChatType;
            var dataChatType = data.chat.type
            var banKeyArr = banKey[chInfo[channelId].key];

            if(isMonitering(chInfo, channel)){
                var wList = chInfo[channelId]["wList"].map(v=>{
                    var channelWList = v.userId;
                    return channelWList;
                })
                // console.log("ismonitoring")
                // if(userPerm===1 || userPerm===4 || userPerm===8 || wList.some(v=>v==String(userInfo.userId))){
                if(userPerm===1 || userPerm===4 || userPerm===8){
                    // console.log("isperm")
                    if (data.text.startsWith("!")) {
                        const command = data.text.slice(1);

                        if(command.startsWith("sw ")){
                            const sw = command.split(" ");
                            if(sw[1]=="off" && chInfo[channelId].isMoniter==true){
                                chInfo[channelId].isMoniter = false;
                                fs.writeFileSync('./json/chInfo.json', JSON.stringify(chInfo));
                                hideChatDelay(data, channel, 125);
                            }
                        }
                        if(command.startsWith("wl")){
                            const sw = command.split(" ");
                            if(!sw[1]){
                                console.log("whitelist");
                                return;
                            }
                            switch (sw[1]) {
                                case "add":
                                    wlAdd(data, channel, chInfo);
                                    break;
                                case "del":
                                    wlDel(data, channel, chInfo);
                                    break;
                                case "reset":
                                    wlReset(data, channel, chInfo);
                                    break;
                                default:
                                    console.log("명령어가 존재하지 않습니다.")
                                    break;
                            }
                            return;
                        }
                        if(command.startsWith("key")){
                            const keyCmd = command.split(" ");
                            if(!keyCmd[1]){
                                let keyList = "";
                                banKeyArr.map(v=>{
                                    keyList+= v+'\u0009'
                                })
                                channel.sendChat(`${keyList}`)
                            }
                            switch(keyCmd[1]){
                                case "add":
                                    // console.log("fuck");
                                    keyAdd(data, channel, banKey, chInfo);
                                    break;
                                // case "new":

                            }
                        }
                    }
                    return;
                }
                // if(wList.some(v=>v==String(userInfo.userId)))return;
                else{
                    if(!isFileExist(channelId)){
                        var file = `./json/channel/${channelId}.json`;
                        fs.writeFileSync(file,JSON.stringify(channelJson),function(err,fd){
                            if (err) throw err;
                            console.log('file open complete');
                        });
                        // fs.writeFileSync(file, JSON.stringify(channelJson));
                    }

                    try {
                        var chJson = updateData(`./json/channel/${channelId}.json`);
                        try {
                            var userId = String(userInfo.userId)
                        } catch (error) {
                            console.log("※에러발생※userId 오류※")
                            return;
                        }
                        
                        // console.log(`userid = ${userId}`)
                        if(!chJson["userChatList"][userId]){
                            chJson["userChatList"][userId]={
                                chatLog : [],
                                chatType : []
                            }
                        }
                        // chJson["userChatList"][userId] = [];
                        chJson["userChatList"][userId]["chatLog"].push(String(data.chat.logId))
                        chJson["userChatList"][userId]["chatType"].push(String(data.chat.type))

                        let chkJson = chJson["userChatList"]
                        if(Object.keys(chkJson).length>10){
                            chJson = channelJson;
                        }
                        // console.log(chJson);
                        fs.writeFileSync(`./json/channel/${channelId}.json`, JSON.stringify(chJson));
                    } catch (error) {
                        console.log(error);
                    }

                    if (isSpam(userInfo.userId)) {
                        if(isDeport(chInfo, channel)){
                            console.log("광고도배 유저 내보내기")
                            const openchannel = channel as TalkOpenChannel;
                            openchannel.kickUser(userInfo);
                        }
                        userChatListHide(channel, userInfo)
                        return;
                    }
                    // else{
                    //     delete chJson["userChatList"][userId]
                    //     fs.writeFileSync(`./json/channel/${channelId}.json`, JSON.stringify(chJson));
                    // }
                    
                    

                    if(chatTypeChk(chatTypeArr, dataChatType, data)){
                        console.log("감지");
                        let now = new Date();
                        saveLog(data, channel, now)

                        if(isDeport(chInfo, channel)){
                            console.log("유저 내보내기")
                            const openchannel = channel as TalkOpenChannel;
                            openchannel.kickUser(userInfo);

                            userChatListHide(channel, userInfo)
                        }
                        else{
                            hideChatDelay(data, channel, 125);
                        }

                        console.log("채팅타입 감지에 따른 가리기 처리")
                        return;
                    }

                    if(chatWordChk(data.text, banKeyArr)){
                        let now = new Date();
                        saveLog(data, channel, now)

                        if(isDeport(chInfo, channel)){
                            console.log("유저 내보내기")
                            const openchannel = channel as TalkOpenChannel;
                            openchannel.kickUser(userInfo);

                            userChatListHide(channel, userInfo)
                        }else{
                            hideChatDelay(data, channel, 125);
                        }
                        console.log("밴키워드 감지로 인한 가리기 처리")
                        return;
                    }
                    
                }
            }
            else{
                // console.log("isnotmonitoring")
                if(userPerm===1 || userPerm===4 || userPerm===8){
                    if(data.text=="!sw on"){
                        if(chInfo[channelId].isMoniter==false){
                            chInfo[channelId].isMoniter = true;
                            fs.writeFileSync('./json/chInfo.json', JSON.stringify(chInfo));
                            hideChatDelay(data, channel, 125);
                            return;
                        }
                        else return;
                    }

                    return;
                }
            }
        }
    } catch (error) {
        console.log(error);
        return;
    }
});

// CLIENT.on('user_join', async (joinchat, channel, user, feed) => {
//     try {
//         // let accountInfo = updateData("./account.json");
//         // let accessToken = accountInfo.accessTok
        
//         const openchannel = channel as TalkOpenChannel;

//         if(isOpenChat(channel)){

//             const isK = await joincheckKorean(user.userId, channel)

//             if(!isK){
//                 try {
//                     openchannel.kickUser({userId : user.userId});
//                     // channel.sendChat("해외계정 감지로 인해 내보내기 처리됩니다.")
//                     console.log(`※해외계정 감지※ : ${user.nickname}`)

//                     userChatListHide(channel, user)
//                     return;
//                 } catch (error) {
//                     console.log(`선물에러 : ${error}`);
//                     return;
//                 }
//             }else{
//                 // channel.sendChat("한국 계정입니다.")
//             } 
//         }

//         // const banKey = updateData("./json/banKey.json");

//         // const banNick = banKey["name"]

//         // if(banNick.some(e=>user.nickname.includes(e))){
//         //     openchannel.kickUser({userId : user.userId});
//         //     // channel.sendChat(`※닉네임 감지※ : [${user.nickname}]`)
//         //     console.log(`※닉네임 감지※ : [${user.nickname}]`)
//         //     return;
//         // }
//         return;
//     } catch (error) {
//         console.log(error);
//         return;
//     }
// })

CLIENT.on('user_join', (joinchat, channel, user, feed) => {
    try {
        const openchannel = channel as TalkOpenChannel;
        const banKey = updateData("./json/banKey.json");

        const banNick = banKey["name"]

        if(banNick.some(e=>user.nickname.includes(e))){
            openchannel.kickUser({userId : user.userId});
            // channel.sendChat("광고계정 감지로 인해 내보내기 처리됩니다.")
            console.log(`※닉네임 감지※ : [${user.nickname}]`)
            return;
        }
        return;
    } catch (error) {
        console.log(error);
        return;
    }
})

// CLIENT.on('profile_changed', (channel, lastInfo, user) => {
//     try {
//         const openchannel = channel as TalkOpenChannel;
//         let channelId = String(channel.info.channelId);
//         let userPerm = user.perm;

//         const banKey = updateData("./json/banKey.json");
//         let chInfo = updateData("./json/chInfo.json");  //채널정보 가져오기

//         const banNick = banKey["name"]

//         var wList = chInfo[channelId]["wList"].map(v=>{
//             var channelWList = v.userId;
//             return channelWList;
//         })
//         // if(userPerm===1 || userPerm===4 || userPerm===8 || wList.some(v=>v==String(user.userId)))return;
//         if(userPerm===1 || userPerm===4 || userPerm===8)return;
//         if (lastInfo.nickname != user.nickname) {
//             if(banNick.some(e=>user.nickname.replace(/ /g,"").includes(e))){
//                 openchannel.kickUser({userId : user.userId});
//                 // channel.sendChat("광고계정 감지로 인해 내보내기 처리됩니다.")
//                 console.log(`※닉네임 감지※ : [${user.nickname}]`)

//                 return;
//             }
//             return;
//         }
//         return;
//     } catch (error) {
//         console.log(error)
//         return;
//     }
// })

CLIENT.on('user_left', (leftchat, channel, user, feed) => {
    try {
        // let channelId = String(channel.info.channelId);
        // const openchannel = channel as TalkOpenChannel;

        let chInfo = updateData("./json/chInfo.json");

        // console.log("fuck");

        if(isMonitering(chInfo, channel)){
            switch (Number(feed.feedType)) {
                case 6:
                    console.log("유저채팅 가리기 실행")

                    userChatListHide(channel, user)
                    break;
            }
        }
    } catch (error) {
        console.log(error);
        return;
    }
})

async function getLoginData(): Promise<api.LoginData> {
    const api = await AuthApiClient.create(DEVICE_NAME, DEVICE_UUID);
    const loginRes = await api.login({
        email: EMAIL,
        password: PASSWORD,
        // forced: true,
    });
    if (!loginRes.success) throw new Error(`Web login failed with status: ${loginRes.status}`);
    // console.log(loginRes)
    return loginRes.result;
}

async function login() {
    const loginData = await getLoginData();

    let accountInfo = updateData("./account.json")
    accountInfo.accessTok = `${loginData.accessToken}-${DEVICE_UUID}`
    // accountInfo.loginTime = time
    accountInfo.accessToken = loginData.accessToken
    accountInfo.refreshToken = loginData.refreshToken
    accountInfo.userId = loginData.userId

    fs.writeFileSync('./account.json', JSON.stringify(accountInfo));

    let count = 0;
    let res = await CLIENT.login(loginData);

    if (!res.success) {
        if (res.status != -203) {
            throw new Error(`Login failed with status: ${res.status}`);
        } else {
            while (true) {
                console.log(`[ ${++count} ] Login Error: ${res.status} ${String(KnownDataStatusCode[res.status])}`);
                res = await CLIENT.login(loginData);

                if (res.success) break;
            }
        }
    }

    console.log('Login success');
}

async function main() {
    await login();
}

main().then();
