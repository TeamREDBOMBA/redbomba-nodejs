var dbinfo = require('./dbinfo.js');
var functions = require('./functions.js');

var mysql = require('mysql');
var mysqlConfig = dbinfo.config();

var mysql_conn;

function handleDisconnect(){
  mysql_conn = mysql.createConnection(mysqlConfig);
  
  mysql_conn.connect(function(err) {
    if(err) {
      console.log('error when connecting to db:', err);
      setTimeout(handleDisconnect, 2000);
    } 
  });

  mysql_conn.on('error', function(err) {
    console.log('db error', err);
    if(err.code === 'PROTOCOL_CONNECTION_LOST') {
      handleDisconnect();
    } else {
      throw err;
    }
  });
}

handleDisconnect();

var io = require('socket.io').listen(80);
var user = [];
var result = [];
result['A'] = [];
result['B'] = [];
io.sockets.on('connection', function (socket) {

  socket.on('disconnect', function () {
    var sid = user[socket.id];
    var sgroup = 0;
    var sround = 0;
    console.log(socket.id+"("+user[socket.id]+") is disconneted.");
    socket.get('Group', function (error, res){
      sgroup=res;
       socket.leave(res);
     });
    socket.get('Round', function (error, res){
      sround=res;
       socket.leave(res);
     });
    delete user[socket.id];
    chkOnline(sid,"Group","disconnect");
    chkOnline(sid,"Round","disconnect");
    io.sockets.in(sgroup).emit("isOffline",sid);
    io.sockets.in(sround).emit("isRoundOffline",sid);
  });

  socket.on('addUser', function (data){
    user[socket.id] = data;
    chkOnline(data,"Group","addUser");
    console.log("user:"+user);
  });

  socket.on('setHTML', function (data) {
    if(data.to == 'all' || data.to == ''){
      io.sockets.emit('html',{'name':data.name, 'html':data.html});
    }else{
      for(key in user){
        if(user[key] == data.to){
          io.sockets.sockets[key].emit('html',{'name':data.name, 'html':data.html});
        }
      }
    }
  });

  socket.on('test', function (data){
    console.log(data);
  });

  //--------------------------------------------------------------------------------------------------------------
  //-------------------------------------------------- Chatting --------------------------------------------------
  //--------------------------------------------------------------------------------------------------------------


  socket.on('chatGroup', function (data) {
    socket.get('Group', function (error, res){
      if(res){
        var gid = res.replace('Group', '');
        var uid = user[socket.id];
        if(data.name == "redbomba") uid = 1;
        data.con = functions.htmlEscape(data.con)
        var con = data.con;
        mysql_conn.query('insert into home_chatting (gid_id,uid_id,con,date_updated) values ("'+gid+'","'+uid+'","'+con+'","'+functions.getTimeStamp()+'")',function(error){
              if(error) console.log("insert error:"+error);
              else io.sockets.in(res).emit("setChat",data);
            });
      }
    });
  });

  //------------------------------------------------------------------------------------------------------------------
  //-------------------------------------------------- Notification --------------------------------------------------
  //------------------------------------------------------------------------------------------------------------------

  socket.on('loadNotification', function (data){
      mysql_conn.query('select id, tablename from home_notification where uid_id = '+data+' and date_read = "-1";',function(error,r3){
        try{
          var val = 0;
          var val_l = 0;
          if(r3.length > 0 ){
            for(i=0;i<r3.length;i++){
              val++;
              if(r3[i].tablename.indexOf("league") != -1) val_l++;
            }
          }
          if(!val) val = '';
          if(!val_l) val_l = '';
          for(i=0;i<functions.getUserId(user,data).length;i++){
            ui = functions.getUserId(user,data)[i];
            io.sockets.sockets[ui].emit('html',{'name':'#noti_value','html':val});
            io.sockets.sockets[ui].emit('html',{'name':'#field_value','html':val_l});
          }
        }catch(e){
          console.log(e.message);
        }
      });
  });

socket.on('sendNotification', function (data){
  console.log('fromHTML:');
  console.log(data);
  if(data.tablename == "home_feed"){
    /*-- Notify to feed's owner. --*/
    mysql_conn.query('select ufrom, uto from home_feed where id='+data.uto,function(error,res){
      try{
      if(error){
        console.log("Feed_error:"+error)
      }else{
        if(res[0].ufrom != res[0].uto){
          if(data.ufrom != res[0].ufrom) setNotification(res[0].ufrom,data.tablename,data.uto);
          if(data.ufrom != res[0].uto) setNotification(res[0].uto,data.tablename,data.uto);
        }
      }
      }catch(e){
          console.log(e.message);
        }
    });
    /*--// Notify to feed's owner. //--*/
    
    /*-- Notify to people who wrote reply in feed.. --*/ 
    mysql_conn.query('select distinct ufrom_id from home_reply where fid_id='+data.uto,function(error,res){
      try{
      if(error){
        console.log("Reply_error:"+error);
      }else{
        for(var ele in res){
          if(data.ufrom != res[ele].ufrom){
            setNotification(res[ele].ufrom,data.tablename,data.uto);
          }
        }
      }
      }catch(e){
          console.log(e.message);
        }
    });
    /*--// Notify to people who wrote reply in feed.. //--*/
    
  }else if(data.tablename == "home_smile"){ // When Smile was inserted
  
    /*-- Notify to feed's owner. --*/
    mysql_conn.query('select f.ufrom, f.ufromtype, f.uto, f.utotype from home_smile s, home_feed f where s.fid = f.id AND f.id='+data.uto,function(error,res){
      if(error){
        console.log("Smile_error:"+error)
      }else{
        if(res[0].ufrom != res[0].uto && res[0].ufromtype == res[0].utotype){
          if(data.ufrom != res[0].ufrom) setNotification(res[0].ufrom,data.tablename,data.uto);
          if(data.ufrom != res[0].uto) setNotification(res[0].uto,data.tablename,data.uto);
        }else if(res[0].ufromtype != res[0].utotype){
          if(data.ufrom != res[0].ufrom) setNotification(res[0].ufrom,data.tablename,data.uto);
        }
      }
    });
    /*--// Notify to feed's owner. //--*/

    }else if(data.tablename == "home_reply"){ // When reply was inserted

    /*-- Notify to people who wrote reply in feed.. --*/ 
    mysql_conn.query('select distinct ufrom_id from home_reply where fid_id='+data.uto,function(error,res){
      try{
        if(error){
          console.log("Reply_error:"+error);
        }else{
          for(var ele in res){
            console.log(Number(data.ufrom)+", "+res[ele].ufrom_id)
            if(Number(data.ufrom) != res[ele].ufrom_id){
              setNotification(res[ele].ufrom_id,data.tablename,data.uto);
            }
          }
        }
      }catch(e){
        console.log(e.message);
      }
    });
    /*--// Notify to people who wrote reply in feed.. //--*/
  }else if(data.tablename == "home_league"){ // When reply was inserted
    mysql_conn.query('select uid_id from home_groupmember where gid_id='+data.gid,function(error,res){
      try{
        if(error){
          console.log("Reply_error:"+error);
        }else{
          for(var ele in res){
            setNotification(res[ele].uid_id,data.tablename,data.lid);
          }
        }
      }catch(e){
        console.log(e.message);
      }
    });
    /*--// Notify to people who wrote reply in feed.. //--*/
  }else if(data.tablename == "home_leagueround"){
    mysql_conn.query('select uid_id from home_groupmember where gid_id in (select gid_id from home_leagueteam where round_id in (select id from home_leagueround where id="'+data.lid+'" and round="'+data.round+'"))',function(error,res){
      try{
        if(error){
          console.log("Reply_error:"+error);
        }else{
          for(var ele in res){
            setNotification(res[ele].uid_id,data.tablename,data.lid);
          }
          runMatchAlarm(data.lid);
        }
      }catch(e){
        console.log(e.message);
      }
    });
    /*--// Notify to people who wrote reply in feed.. //--*/
  }else if(data.tablename == "home_group"){ // When group was inserted
    console.log(data.uid+", "+data.tablename+", "+data.gid);
    setNotification(data.uid,data.tablename,data.gid);
    /*--// Notify to people who wrote reply in feed.. //--*/
  }
});


  //-----------------------------------------------------------------------------------------------------------
  //-------------------------------------------------- Group --------------------------------------------------
  //-----------------------------------------------------------------------------------------------------------
  
  socket.on('joinGroup', function (data){
    socket.join('Group'+data);
    socket.set('Group', 'Group'+data);
    console.log(data);
  });
  
  socket.on('leaveGroup', function (data){
    socket.get('Group', function (error, group){
      console.log(group+"leave Group");
       socket.leave(group);
     });
  });
    
   socket.on('isOnline', function (data){
     for(n in data){
       chkOnline(data[n],"Group","isOnline");
     }
  });
  
  socket.on('setGroup', function (data) {
    if(data.to=="group"){
      console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! = "+data.id);
      io.sockets.in('Group'+data.id).emit('group',data);
    }else if(data=="all"){
      io.sockets.emit('group',data);
    }else{
      if(functions.getUserId(user,data.id).length) io.sockets.sockets[functions.getUserId(user,data.id)[0]].emit('group',data);
    }
  });

  //------------------------------------------------------------------------------------------------------------
  //-------------------------------------------------- League --------------------------------------------------
  //------------------------------------------------------------------------------------------------------------

  socket.on('addRoundUser', function (data){
    user[socket.id] = data;
    chkOnline(data,"Round","addRoundUser");
    console.log(user);
  });

  socket.on('joinRound', function (data){
    socket.join("Match"+data.round_id);
    socket.set('Round', "Match"+data.round_id);
    mysql_conn.query('select state, result from `home_leaguematch` where `id`='+data.round_id+';',function(error, res){
      if(error) console.log("insert error:"+error);
      else{
        console.log("state:"+res[0].state);
        if(res[0].state == 3 && res[0].result != data.side){
          socket.emit("state",{'state':3,'result':res[0].result});
        }else if(res[0].state == 7 && res[0].result != data.side){
          socket.emit("state",{'state':6,'result':res[0].result});
        }else{
          socket.emit("state",{'state':res[0].state,'result':res[0].result});
        }
      }
    });
  });
  
  socket.on('leaveRound', function (data){
    socket.get('Round', function (error, round){
      console.log(user[socket.id]+" leave "+round)
       socket.leave(round);
     });
  });

  socket.on('EnterRound', function (data){
     for(n in data){
       chkOnline(data[n],"Round","EnterRound");
     }
  });

  socket.on('setResult', function (data){
    socket.get('Round', function (error, round){
      result[data.side][round] = data.result;
      console.log(round+"_"+data.side+"="+result[data.side][round]);
      if(result['A'][round]&&result['B'][round]){
        if(result['A'][round] == result['B'][round]){
          io.sockets.in(round).emit("setResult",0);
        }else{
          var winner = '';
          if(result['A'][round]=='win') winner='A';
          else if(result['B'][round]=='win') winner='B';
          data.winner = winner;
          data.result = winner;
          io.sockets.in(round).emit("setResult",1);
          data.state = 10;
          mysql_conn.query('UPDATE `redbomba`.`home_leaguematch` SET `state`=10, `result`="'+winner+'" WHERE `id`='+data.lid+';',function(error){
            if(error){
              console.log("insert error:"+error);
            } else {
              mysql_conn.query("SELECT bestof FROM `redbomba`.`home_leagueround` WHERE id = (SELECT round_id FROM `redbomba`.`home_leagueteam` WHERE id = (SELECT team_a_id FROM `redbomba`.`home_leaguematch` WHERE id = '"+data.lid+"'))",function(error, bestof){
                if(error){
                  console.log("insert error:"+error);
                }else{
                  mysql_conn.query("SELECT * FROM `redbomba`.`home_leaguematch` WHERE "
                    +"team_a_id = (SELECT team_a_id FROM `redbomba`.`home_leaguematch` WHERE id = "+data.lid+") AND "
                    +"team_b_id = (SELECT team_b_id FROM `redbomba`.`home_leaguematch` WHERE id = "+data.lid+");",function(error, games){
                      var team_a_wins = 0;
                      var team_b_wins = 0;
                      for(i in games){
                        if(games[i].result == "A") team_a_wins++;
                        else if(games[i].result == "B") team_b_wins++;
                      }
                      var bestofHalf = Number(bestof[0].bestof)/2.0;
                      console.log("BH = "+bestofHalf+", A = "+team_a_wins+", B = "+team_b_wins);
                      if(team_a_wins > bestofHalf || team_b_wins > bestofHalf){ // 여기부터 수정
                        socket.get('Round', function (error, res){
                          console.log("Send to "+res+". ("+data.state+")");
                          io.sockets.in(res).emit("state",data);
                        });
                        delete result['A'][round];
                        delete result['B'][round];
                      }else{
                        mysql_conn.query("INSERT INTO `redbomba`.`home_leaguematch` (SELECT 0, game+1, team_a_id, team_b_id, host, 0, 0, date_match, date_updated FROM `redbomba`.`home_leaguematch` WHERE id='"+data.lid+"')",function(error){
                          if(error) console.log("insert error:"+error);
                          socket.get('Round', function (error, res){
                            console.log("Send to "+res+". (Refresh)");
                            io.sockets.in(res).emit("refresh","");
                          });
                          delete result['A'][round];
                          delete result['B'][round];
                        });
                      }
                  });
                }
              });
            }
          });
        }
      }
    });
  });

  socket.on('state', function (data){
    switch(data.state){
      case 0:
        data.state = 1;
        socket.get('Round', function (error, res){
          console.log("Send to "+res+". ("+data.state+")");
          socket.broadcast.to(res).emit("state",data);
        });
        break;
      case 1:
        data.state = 2;
        mysql_conn.query('UPDATE `redbomba`.`home_leaguematch` SET `state`="'+data.state+'", `result`="'+data.roomtitle+'" WHERE `id`='+data.lid+';',function(error){
          if(error) console.log("insert error:"+error);
        });
        socket.get('Round', function (error, res){
          console.log("Send to "+res+". ("+data.state+")");
          io.sockets.in(res).emit("state",data);
        });
        break;
      case 2:
        data.state = 3;
        mysql_conn.query('UPDATE `redbomba`.`home_leaguematch` SET `state`="'+data.state+'", `result`="'+data.side+'" WHERE `id`='+data.lid+';',function(error){
          if(error) console.log("insert error:"+error);
        });
        socket.get('Round', function (error, res){
          console.log("Send to "+res+". ("+data.state+")");
          io.sockets.in(res).emit("state",data);
        });
        break;
      case 3:
        data.state = 4;
        mysql_conn.query('UPDATE `redbomba`.`home_leaguematch` SET `state`="'+data.state+'", `result`="'+data.side+'" WHERE `id`='+data.lid+';',function(error){
          if(error) console.log("insert error:"+error);
        });
        socket.get('Round', function (error, res){
          console.log("Send to "+res+". ("+data.state+")");
          io.sockets.in(res).emit("state",data);
        });
        break;
      case 4:
        data.state = 5;
        var timeInMs = Date.now();
        data.result = timeInMs;
        mysql_conn.query('UPDATE `redbomba`.`home_leaguematch` SET `state`="'+data.state+'", `result`="'+timeInMs+'" WHERE `id`='+data.lid+';',function(error){
          if(error) console.log("insert error:"+error);
        });
        socket.get('Round', function (error, res){
          console.log("Send to "+res+". ("+data.state+")");
          io.sockets.in(res).emit("state",data);
        });
        break;
      case 5:
        data.state = 6;
        mysql_conn.query('UPDATE `redbomba`.`home_leaguematch` SET `state`="'+data.state+'", `result`="waiting" WHERE `id`='+data.lid+';',function(error){
          if(error) console.log("insert error:"+error);
        });
        socket.get('Round', function (error, res){
          console.log("Send to "+res+". ("+data.state+")");
          io.sockets.in(res).emit("state",data);
        });
        break;
      case 6:
        data.state = 7;
        mysql_conn.query('select state, result from `home_leaguematch` where `id`='+data.lid+';',function(error, res){
          if(error) console.log("insert error:"+error);
          else{
            if(res[0].state == 6){
              mysql_conn.query('UPDATE `redbomba`.`home_leaguematch` SET `state`=7, `result`="'+data.side+'" WHERE `id`='+data.lid+';',function(error){
                if(error){ console.log("insert error:"+error); }
              });
              socket.get('Round', function (error, res){
                console.log("Send to "+res+". ("+data.state+")");
                io.sockets.in(res).emit("state",data);
              });
            }else{
              data.state = 8;
              var timeInMs = Date.now();
              data.result = timeInMs;
              console.log(data);
              mysql_conn.query('UPDATE `redbomba`.`home_leaguematch` SET `state`=8, `result`="'+timeInMs+'" WHERE `id`='+data.lid+';',function(error){
                if(error) console.log("insert error:"+error);
              });
              socket.get('Round', function (error, res){
                console.log("Send to "+res+". ("+data.state+")");
                io.sockets.in(res).emit("state",data);
              });
            }
          }
        });
        break;
      case 8:
        console.log(data);
        socket.get('Round', function (error, res){
          console.log("Send to "+res+". ("+data.state+")");
          io.sockets.in(res).emit("state",data);
        });
        break;
    }
  });
  

  //--------------------------------------------------------------------------------------------------------------
  //-------------------------------------------------- Function --------------------------------------------------
  //--------------------------------------------------------------------------------------------------------------

  function chkOnline(data,status,func){
    if(status=="Round"){
      var myround = 0;
      socket.get(status, function (error, res){ myround = res });
      if(functions.getUserId(user,data)[0]){
        io.sockets.sockets[functions.getUserId(user,data)[0]].get(status, function (error, res){
          console.log("chkOnline("+status+"):user_"+data+"("+functions.getUserId(user,data)+") in "+res);
          if(res == myround) io.sockets.in(res).emit("isRoundOnline",data);
          else io.sockets.in(res).emit("isRoundOffline",data);
        });
      }
    }else if(status == "Group"){
      socket.get(status, function (error, res){
        console.log("chkOnline("+status+"):user_"+data+"("+functions.getUserId(user,data)+") in "+res);
        if(functions.getUserId(user,data).length) io.sockets.in(res).emit("isOnline",{"id":data,"func":func});
        else io.sockets.in(res).emit("isOffline",{"id":data,"func":'isOffline'});
      });
    }
  }
});

function setNotification(uid,tablename,contents){
    mysql_conn.query('insert into home_notification (uid_id,tablename,contents,date_read,date_updated) values ("'+uid+'","'+tablename+'","'+contents+'","-1","'+functions.getTimeStamp()+'")',function(error){
      if(error){
        console.log("insert error:"+error)
      }else{
        mysql_conn.query('select uid_id from home_notification where uid_id='+uid,function(error,res){
          try{
            var innertext = res.length;
            for(i=0;i<functions.getUserId(user,uid).length;i++){
              io.sockets.sockets[functions.getUserId(user,uid)[i]].emit('html',{'name':'#noti_value','html':innertext});
              if(tablename.search("league") != -1) io.sockets.sockets[functions.getUserId(user,uid)[i]].emit('leagueReload','true');
            }
          }catch(e){
            console.log(e.message);
          }
        });
      }
    });
  }

// runMatchAlarm(0);

function runMatchAlarm(v){
  var date_match = [];
  var date_now = new Date();
  date_now.setHours(date_now.getHours()-9);
  date_now.setSeconds(date_now.getSeconds()-30);
  var qStr = "select id,";
  qStr += "date_format(date_match, '%Y') AS y,";
  qStr += "date_format(date_match, '%m') AS m,";
  qStr += "date_format(date_match, '%d') AS d,";
  qStr += "date_format(date_match, '%H') AS h,";
  qStr += "date_format(date_match, '%i') AS i,";
  qStr += "date_format(date_match, '%s') AS s";
  qStr +=" from `home_leaguematch` where date_match > '"+functions.dateFormat(date_now)+"'";
  if(v) qStr +=" AND (team_a_id in (select id from home_leagueteam where round_id = "+v+") OR team_b_id in (select id from home_leagueteam where round_id = "+v+"));";
  mysql_conn.query(qStr,function(error, res){
    if(error){
      console.log("insert error:"+error);
    }else{
      console.log("NOW==========================="+functions.getUnixtime(date_now));
      for(i in res){
        date_match[i] = new Date(res[i].y,res[i].m - 1,res[i].d,res[i].h,res[i].i,res[i].s);
        date_match[i].setMinutes(date_match[i].getMinutes()-30);
        time_diff = functions.getUnixtime(date_match[i]) - functions.getUnixtime(date_now);
        console.log(res[i].id+"===="+functions.dateFormat(date_match[i])+"===="+functions.getUnixtime(date_match[i])+"===="+time_diff);
        (function(id, time_diff){
          setTimeout(function(){
            console.log(id+"===========================called");
            mysql_conn.query('select uid_id from home_groupmember where gid_id in (select group_id_id from home_leagueteam where id in (select team_a_id from home_leaguematch where id='+id+' ) or id in (select team_b_id from home_leaguematch where id='+id+' ))',function(error,res2){
              try{
                if(error){
                  console.log("Reply_error:"+error);
                }else{
                  for(var ele in res2){
                    console.log("setTimeout : "+res2[ele].uid_id);
                    setNotification(res2[ele].uid_id,'home_leaguematch',id);
                  }
                }
              }catch(e){
                console.log(e.message);
              }
            });
          },time_diff);
        }(res[i].id, time_diff));
      }
    }
  });
}