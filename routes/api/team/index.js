const { config } = require('../../../app')
const db = require('../../../database/team')
const crypto = require('crypto')

/**
 * team api 竞赛组队API
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

    if(type==1 && Object.keys(data).length==9 ){
      let {schoolNum,teamName,deadLine} = data;
      let count=await db.team.count('*',{schoolNum});

      if(count==2){
        throw '同时可发布数已达上限(两个)';
      }

      let tid = crypto.createHash('sha256')
                      .update( teamName )
                      .update( deadLine ) 
                      .update( schoolNum )
                      .digest( 'hex' );
      data.tid=tid;
      data.currentPeople=schoolNum;
      try{
        db.team.insert(data);
        return {status:0}
      }
      catch(e){
        throw '队伍建立失败';
      }
      //==================
    }else if(type==2 && Object.keys(data).length==7){

      let {tid,applicant,description}=data;

      let pid = crypto.createHash('sha256')
                      .update( tid )
                      .update( applicant ) 
                      .update( description )
                      .digest( 'hex' );

      data.pid=pid;
      data.status=0;
      try{
        db.registration.insert(data);
        return {status:0};
      }
      catch(e){
        throw "commit application failed"
      }
      //===================
    }else if(type==3 && Object.keys(data).length==3){
      let {rid,text,response}=data;

      let regisContent=db.registration.find({rid});
      if(regisContent.status!=0){
        throw "reply failed";
      }
      let targetTeam=db.team.find({tid:regisContent.tid});
      let currentPeople=targetTeam.currentPeople.splite(' ');
      
      if(currentPeople.length>=targetTeam.maxPeople){
        throw "number of alias is up to limit";
      }
      try{
        let updatedPeople=currentPeople+` ${this.user.schoolNum}`;
        db.team.update({tid:regisContent.tid},
          {currentPeople:updatedPeople});

        let status=response?1:2;
        db.registration.update({rid},
          {status,updateTime:+moment(),responseText:response});

        return {status:0}

      }
      catch(e){
        throw "database exception"
      }

    }else throw 'unknown request type'
  },

  async put({ tid, capacity=0, description='' }) {

    let team = await db.team.find({ tid })
    let { cardnum } = this.user
    let updateTime = +moment()

    if ( team.organizer === cardnum ) {
      try {
        if (capacity) {
          await db.team.update({ tid }, { capacity, updateTime })
        }
        if (description) {
          await db.team.update({ tid }, { description, updateTime })
        }
      } catch(e) {
        throw '数据库错误'
      }
    } else {
      throw 403
    }
  }, 

  async delete({ tid }) {
    let team = await db.team.find({ tid })
    let { cardnum } = this.user

    if ( team.organizer === cardnum ) {
      try {
        await db.team.delete({ tid })
      } catch(e) {
        throw '数据库错误'
      }
    } else {
      throw 403
    }
  }
}