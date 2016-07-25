var settings=require('./settings.json');
var debug=$('debug')('ifttt:device');
var EventEmitter=require('events');
var io=$('socket.io-client').connect(settings.url);

var devices={};

global.device={status:function(name, state, callback){
        if(typeof(devices[name])=='undefined')
        {
            var device=devices[name]=new EventEmitter();
            io.emit('join', 'device:'+name)
            io.on('status', function(status){
                if(status.device!=name)
                    return;
                if(typeof(status.state)=='string')
                    device.emit(status.state, {status:status.state});
                device.emit('status', {status:status.state});
            });
        }
        if(state)
            devices[name].on(state, callback);
        else
            devices[name].on('status', callback);
        
    },
    forceStatus:function(name, callback)
    {
        console.log('calling device status for '+name );
        $.getJSON(settings.url+'/api/device/'+name+'?status=true', callback);
    },
    cmd:function(name, cmd, callback)
    {
        console.log('calling ',cmd,' on device ', name);
        $.getJSON(settings.url+'/api/device/'+name+'?cmd='+cmd, callback);
    }
};
     
process.on('exit', function(){
    io.disconnect();
});

module.exports={name:"device", "triggers":[{name:"status", fields:[{ name:"state", displayName:"expectedState"}, {name:"device", displayName:"Device"}], 
    when:function(fields,callback){
        device.status(fields.device, fields.state, function(state){
            callback({status:state});
        });
    }
}], "actions":[{name:"command", fields:[{ name:"cmd", displayName:"Command"}, {name:"device", displayName:"Device"}], delegate:function(fields){
        var result= function(fields, trigger, completed){
			try
			{
			    device.cmd(fields.device, fields.cmd, completed);
			}
			catch (ex)
			{
				console.log(ex);
			}
        };
        result.fields=fields;
        return result;
}}], "conditions":[
    {
        name:'status',
        fields:[{ name:"state", displayName:"Expected state"}, {name:"device", displayName:"Device"}], 
        evaluate:function(params){
            var result;
            device.status(params.device, null, function(state){
                result=state.status==params.state;
            });
            return function(triggerFields, callback)
            {
                debug(params.device, result);
                if(typeof(result)=='undefined')
                {
                    device.forceStatus(params.device, function(state)
                    {
                        debug(params.device, state);
                        result=state==params.state;
                        callback(result);
                    });
                }
                else
                    callback(result);
            };
        }
    },
        {
        name:'is not',
        fields:[{ name:"state", displayName:"Expected state"}, {name:"device", displayName:"Device"}], 
        evaluate:function(params){
            var result;
            device.status(params.device, null, function(state){
                result=state.status!=params.state;
            });
            return function(triggerFields, callback)
            {
                callback(result);
            };
        }
    }

]};