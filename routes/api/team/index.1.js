const { config } = require('../../../app')
const db = require('../../../database/team')
const crypto = require('crypto')

/**
 * /api/team 竞赛组队API
 */
exports.route = {
  async get({type,page=0}){

    let pageSize=6;
    if(type==1){

      let data=await db.team.find({},pageSize,(page-1)*pageSize,'publishedDate');
      return data;

    }else if(type==2){

      let {cardnum}=this.user;

      let published=await db.team.find(
        {cardnum},
        pageSize,(page-1)*pageSize,'publishedDate');

      let requested=await db.registration.find(
        {cardnum},
        pageSize,(page-1)*pageSize,'applicationDate');

      let tids=[].concat(published).map(eachColume=>eachColume.tid);

      let received=await db.registration.find(
        {tid:{$in:tids}},
        pageSize,(page-1)*pageSize,'applicationDate');

        return{published,requested,received};
    }
    else{
     throw 'unknown request type';
    }
  },

  async post({ type , data }){
    data=JSON.parse(data);
    let selfcardnum=this.user.cardnum;

    if(type==1  ){
      let {teamName,deadLine} = data;
      let count=await db.team.count('*',{selfcardnum});

      if(count==2){
        throw '同时可发布数已达上限(两个)';
      }

      let tid = crypto.createHash('sha256')
                      .update( teamName )
                      .update( deadLine )
                      .update( selfcardnum )
                      .digest( 'hex' );
      data.tid=tid;
      data.currentPeople=selfcardnum;
      data.cardnum=selfcardnum;
      data.publishedDate=+moment();
      try{
        await db.team.insert(data);
        return {status:0}
      }
      catch(e){
        throw '数据库错误';
      }
      //==================新建申请==========
    }else if(type==2){

      let {tid}=data;

      let targetTeam=await db.team.find({tid},1);
      let currentPeople=targetTeam.currentPeople.split(' ');

      if(currentPeople.length>=targetTeam.maxPeople){
        throw "队内人数已达上限";
      }
      let findRegis=await db.registration.find({tid,cardnum:selfcardnum,status:{$in:[0,1]}},1);
      if(findRegis)
        throw "不可重复申请";

      data.status=0;
      data.cardnum=selfcardnum;
      data.applicationDate=data.updateDate=+moment();
      data.rid = crypto.createHash('sha256')
                      .update( tid )
                      .update( `${data.updateDate}` )
                      .update( selfcardnum )
                      .digest( 'hex' );

      try{
        await db.registration.insert(data);
        return {status:0};
      }
      catch(e){
        if(e.errno==19)
          return {status:1};
        throw "commit application failed"
      }

      //===================提交对申请者的回应============

    }else if(type==3){
      let {rid,text,response}=data;

      let targetRegis=await db.registration.find({rid},1);
      if(targetRegis.status!=0){
        throw "reply failed";
      }
      let targetTeam=await db.team.find({tid:targetRegis.tid},1);
      let currentPeople=targetTeam.currentPeople.split(' ');

      try{
        let status = 1;
        if (response) {

          if(currentPeople.length>=targetTeam.maxPeople){
            throw "队内人数已达上限";
          }
    
          let updatedPeople = currentPeople + ` ${targetRegis.cardnum}`;
          await db.team.update({ tid: targetRegis.tid},
             {currentPeople: updatedPeople});

        } else {
          status = 2;
        }
        await db.registration.update({rid}, 
          {status,updateTime: +moment(),responseText: text});

        return {status:0}

      }
      catch(e){
        throw "数据库错误"
      }

    }else throw 'unknown request type'
  },

  async put({ type , data }){
    data=JSON.parse(data);

    let selfcardnum=this.user.cardnum;

    //================修改组队项===========
    if(type==1 && data.tid){
      let {tid}=data;
      let target=await db.team.find({tid},1);

      if(target.cardnum!==selfcardnum)
        throw 403;
      if(target.currentPeople.split(' ').length>data.maxPeople)
        throw '队内人数大于修改的目标值';

      try{
        await db.team.update({tid},data);
        return {status:0}
      }
      catch(e){
        throw '数据库错误';
      }
      //==================修改申请==========
    }else if(type==2 && data.rid){

      let {rid}=data;
      let target=await db.registration.find({rid},1);

      if(target.cardnum!==selfcardnum)
        throw 403;
      try{

        await db.registration.update({rid},data);
        return {status:0};
      }
      catch(e){
        throw "数据库错误";
      }
    }else throw 'unknown request type'
  },

  async delete({ type , tid , rid }) {
    let {cardnum:selfcardnum}=this.user;
    if(type==1){
      let team = await db.team.find({ tid },1);
      if(selfcardnum!==team.cardnum){
        throw 403;
      }
      try{
        await db.registration.update({ tid },{status:4});
        await db.team.remove({tid},1);
        return{ status: 0}
      }
      catch(e){
        throw "数据库错误";
      }
    }else if(type==2){
      let regis = await db.registration.find({ rid },1);
      if(selfcardnum!==regis.cardnum){
        throw 403;
      }
      try{
        await db.registration.update({rid},{status:4});

        return{status:0}
      }
      catch(e){
        throw "数据库错误";
      }
    }else throw "unknown request type";
  }
}
