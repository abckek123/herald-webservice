const _db=require('../database/mongodb');

module.exports=async (ctx,next)=>{

    let _col_team=await _db('team');
    let _col_regis=await _db('registration');
    await _col_regis.createIndex({applicationDate:-1});
    await _col_team.createIndex({publishedDate:-1});

    await next()
}