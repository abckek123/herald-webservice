const { config } = require('../../../app')
const db = require('../../../database/team')
const crypto = require('crypto')

/**
 * /api/team 竞赛组队API
 */
exports.route = {

  async get({type,page=0}){

    let pageSize=6;
    if(type==0){

      let data=await db.team.find({},pageSize,(page-1)*pageSize,'publishedDate');
      return data;

    }else if(type==1){

      let {schoolNum}=this.user;

      let published=await db.team.find(
        {schoolNum},
        pageSize,(page-1)*pageSize,'publishedDate');

      let requested=await db.registration.find(
        {schoolNum},
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

    let selfSchoolNum=this.user.schoolnum;

    if(type==1 && Object.keys(data).length==9 ){
      let {schoolnum,teamName,deadLine} = data;
      let count=await db.team.count('*',{schoolnum});

      if(count==2){
        throw '同时可发布数已达上限(两个)';
      }

      let tid = crypto.createHash('sha256')
                      .update( teamName )
                      .update( deadLine )
                      .update( schoolnum )
                      .digest( 'hex' );
      data.tid=tid;
      data.currentPeople=schoolnum;
      try{
        db.team.insert(data);
        return {status:0}
      }
      catch(e){
        throw '数据库错误';
      }
      //==================新建申请==========
    }else if(type==2 && Object.keys(data).length==7){

      let {tid,applicant,description}=data;

      let rid = crypto.createHash('sha256')
                      .update( tid )
                      .update( applicant )
                      .update( description )
                      .digest( 'hex' );

      data.rid=rid;
      data.status=0;
      try{
        db.registration.insert(data);
        return {status:0};
      }
      catch(e){
        throw "commit application failed"
      }

      //===================提交对申请者的回应============

    }else if(type==3 && Object.keys(data).length==3){
      let {rid,text,response}=data;

      let regisContent=db.registration.find({rid});
      if(regisContent.status!=0){
        throw "reply failed";
      }
      let targetTeam=db.team.find({tid:regisContent.tid});
      let currentPeople=targetTeam.currentPeople.split(' ');

      if(currentPeople.length>=targetTeam.maxPeople){
        throw "number of alias is up to limit";
      }
      try{
        let updatedPeople=currentPeople+` ${selfSchoolNum}`;
        db.team.update({tid:regisContent.tid},
          {currentPeople:updatedPeople});

        let status=response?1:2;
        db.registration.update({rid},
          {status,updateTime:+moment(),responseText:response});

        return {status:0}

      }
      catch(e){
        throw "数据库错误"
      }

    }else throw 'unknown request type'
  },

  async put({ type , data }){

    let selfSchoolNum=this.user.schoolnum;

    //================修改组队项===========
    if(type==1 && data.tid){
      let {tid}=data;
      let target=db.team.find({tid});

      if(target.schoolnum!==selfSchoolNum)
        throw 403;
      if(target.currentPeople.split(' ').length<data.maxPeople)
        throw 400;

      try{
        db.team.update({tid},data);
        return {status:0}
      }
      catch(e){
        throw '数据库错误';
      }
      //==================修改申请==========
    }else if(type==2 && data.rid){

      let {rid}=data;
      let target=db.registration.find({rid});

      if(target.schoolnum!==selfSchoolNum)
        throw 403;
      try{

        db.registration.update({rid},data);
        return {status:0};
      }
      catch(e){
        throw "数据库错误";
      }
    }else throw 'unknown request type'
  },

  async delete({ type , tid , rid }) {
    let {schoolnum:selfSchoolNum}=this.user;
    if(type==1){
      let team = await db.team.find({ tid });
      if(selfSchoolNum!==team.schoolnum){
        throw 403;
      }
      try{
        await db.registration.update({ tid },{status:4});
        await db.team.delete({tid});
        return{ status: 0}
      }
      catch(e){
        throw "数据库错误";
      }
    }else if(type==2){
      let regis = await db.registration.find({ rid });
      if(selfSchoolNum!==regis.schoolnum){
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
