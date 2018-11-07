const { config } = require('../../../app')
const db = require('../../../database/team')
const crypto = require('crypto')

/**
 * /api/team 竞赛组队API
 */
exports.route = {
  async get({type,page=0}){

    let pageSize=6;
    let offset=(page-1)*pageSize;
    if(type==1){

      let data=await db.team.find({},pageSize,offset,'publishedDate');
      return data;

    }else if(type==2){

      let {cardnum}=this.user;

      let published=await db.team.find(
        {cardnum},
        pageSize,offset,'publishedDate');

      let requested=await db`
      SELECT r.*,t.teamName AS teamName,t.projectName AS projectName
      FROM registration r,team t
      WHERE r.tid=t.tid AND r.status<>4
      ORDER BY applicationDate
      LIMIT ${pageSize} OFFSET ${offset}`;  

      let tids=[].concat(published).map(eachColume=>eachColume.tid);

      let received=await db`
      SELECT r.*,t.teamName AS teamName,t.projectName AS projectName
      FROM registration r,team t
      WHERE r.tid IN ${tids.map(i=>`'${i}`)} AND r.status<>4
      ORDER BY applicationDate
      LIMIT ${pageSize} OFFSET ${offset}`;

      return{published,requested,received};
    }
    else{
     throw 'unknown request type';
    }
  },

  async post({teamName,deadLine}){
    let data=this.params;
    let {name,cardnum}=this.user;

    let count=await db.team.count('*',{cardnum});
    let currentTime=moment().unix();
    data.deadLine=moment(data.deadLine,"YYYY-MM-DD").unix();

    if(data.deadLine<currentTime){
      throw "截止日期需超过今日";
    }
    if(count==2){
      throw '同时可发布数已达上限(两个)';
    }

    data.tid = crypto.createHash('sha256')
                    .update( teamName )
                    .update( deadLine )
                    .update( cardnum )
                    .digest( 'hex' );
    
    data.masterName=name;               
    data.currentPeople=cardnum;
    data.cardnum=cardnum;
    data.publishedDate=currentTime;
    try{
      await db.team.insert(data);
      return {status:0}
    }
    catch(e){
      throw '数据库错误';
    }
  },

  async put({tid}){
    let data=this.params;

    let {cardnum}=this.user;
    let targetTeam=await db.team.find({tid},1);

    if(targetTeam.cardnum!==cardnum)
      throw 403;
    if(targetTeam.currentPeople.split(' ').length>data.maxPeople)
      throw '队内人数大于修改的目标值';

    delete data.masterName;
    delete data.cardnum;
    try{
      await db.team.update({tid},data);
      return {status:0}
    }
    catch(e){
      throw '数据库错误';
    }    
  },

  async delete({tid}) {

    let {cardnum}=this.user;
    let team = await db.team.find({ tid },1);

    if(cardnum!==team.cardnum){
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
  }
}
