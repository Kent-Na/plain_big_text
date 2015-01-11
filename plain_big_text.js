
function Command(){
	var command = {};
	command.begin = 0;
	command.end = 0;
	command.diff = "";
	command.revision = 0;
	command.sender = null;

	command.clone = function(){
		var cloned = Command();
		cloned.begin = command.begin;
		cloned.end= command.end;
		cloned.diff= command.diff;
		cloned.revision = command.revision;
		cloned.sender = command.sender;
		return cloned;
	}

	command.encode = function(){
		var text_encoder = new TextEncoder("utf8");
		var encoded_diff = text_encoder.encode(command.diff);

		var r_value = new ArrayBuffer(7+encoded_diff.length);
		var r_view = new DataView(r_value);
		var op_code = 0x00;
		r_view.setUint8(0, op_code);
		r_view.setUint16(1, command.begin);
		r_view.setUint16(3, command.end);
		r_view.setUint16(5, command.revision);

		for (var i = 0; i<encoded_diff.length; i++){
			r_view.setUint8(7+i, encoded_diff[i]);
		}

		return r_value;
	}

	command.apply = function(contents){
		function replace_string(src, dst, begin, end){
			return src.substring(0,begin) + dst + src.substring(end);
		}
		return replace_string(
				contents, command.diff, command.begin, command.end);
	}

	command.is_valid = function(contents){
		var len = contents.length;
		if (begin > len)
			return false;
		if (end > len)
			return false;
		if (begin > end)
			return false;
	}

	return command;
}

Command.decode = function(data_block){
	var command = Command();
	if (data_block.byteLength < 7)
		return null;
	var dataview = new DataView(data_block);
	var op_code = dataview.getUint8(0);
	command.begin = dataview.getUint16(1);
	command.end   = dataview.getUint16(3);
	command.revision = dataview.getUint16(5);

	//This isn't warking at server side....
	//var diff_dataview = data_block.slice(6, data_block.byteLength);

	//But this works fine.
	var diff_dataview = new ArrayBuffer(data_block.byteLength-7);
	{
		var src = new Uint8Array(data_block, 7);
		var dst = new Uint8Array(diff_dataview);
		for (var i = 0; i<dst.length; i++)
			dst[i] = src[i];
	}

	var text_decoder = new TextDecoder('utf8');
	command.diff = text_decoder.decode(diff_dataview);

	return command;
}


//command_0 are already executed at local environmentc
//transform command_1

//command_0: Command witch executed at same revision as command_1.
//command_1: Target command to tronsformed
//is_prioritized: Set True if transforming at server.
//This parametor will affect order of inserted text at 
//exactory same location

function apply_transform(
		command_0, 
		command_1, 
		is_prioritied){
	//rcp_assert(command_0.revision==command_1.revision);

	//command_1.revision = command_0.revision+1;

	var begin_0 = command_0.begin;
	var begin_1 = command_1.begin;
	var end_0= command_0.end;
	var end_1= command_1.end;

	if (begin_0 == begin_1 && end_0 == end_1){
		// 0|--------------|
		// 1|--------------|
		if (!is_prioritied){
			var offset = command_0.diff.length;
			command_1.begin = command_0.begin+offset;
			command_1.end = command_0.begin+offset;
		}
		else{
			command_1.begin = command_0.begin;
			command_1.end = command_0.begin;
		}
	}
	else if (end_0<=begin_1){
		// 0|-------|
		//         1|>-----|
		var offset = command_0.diff.length-(end_0-begin_0);
		command_1.begin += offset;
		command_1.end   += offset;
	}
	else if (end_1<=begin_0){
		//         0|>-----|
		// 1|-------|
		//No transform is required.
	}
	else if (begin_0 <= begin_1 && begin_1 <= end_0 && end_0 <= end_1){
		// 0|---------|
		//     1|----------|
		var base = begin_0 + command_0.diff.length;
		command_1.begin = base;
		command_1.end = base+(end_1-end_0);
	}
	else if (begin_1 <= begin_0 && begin_0 <= end_1 && end_1 <= end_0){
		//     0|----------|
		// 1|---------|
		//command_1.begin = begin_1; //No change.
		command_1.end = begin_0;
	}
	else if (begin_0 < begin_1 && end_1 < end_0){
		// 0|----------|
		//    1|----|
		command_1.diff = "";
		command_1.begin = 0;
		command_1.end = 0;
	}
	else if (begin_1 < begin_0 && end_0 < end_1){
		//    0|----|
		// 1|----------|
		//command_1.begin = begin_1; //No change.
		command_1.end +=
			command_0.diff.length-(end_0-begin_0);
	}
	else{
		//Program should never reach here.
		//console.log("err\n");
		//exit(0);
	}
}

function lift(command_log, command, is_prioritized){
	for (i = command.revision; i<command_log.length; i++){
		var cmd = command_log[i]
		if (cmd.sender == command.sender)
			continue;

		var clone = command.clone();
		apply_transform(command_log[i], command, !is_prioritized);
		apply_transform(clone, command_log[i], is_prioritized);
	}
}

function NewContext(context){
	function State(){
		var state = {};
		state.command_log = [];
		state.log_offset = 0;
		state.revision = 0;
		return state;
	}

	context.on_init_local_site = function(site){
		site.state = State();
		site.state.contents = "";
	}

	context.on_init_neighbor_site = function(site){
		site.state = State();
		if (! site.is_slave){
			var command = Command();
			command.diff = context.local_site.state.contents;
			site.send(command.encode());
			site.state.command_log.push(command.clone());
		}
	}


	context.execute_command = function(raw_command, sender_site){
		var i;
		var command = Command.decode(raw_command);
		if (! command){
			//todo print something
			return;
		}

		command.sender = sender_site;
		var local_state = context.local_site.state;

		if (command.revision > sender_site.state.command_log.length){
			site.reset();
			return;
		}

		if (sender_site != context.local_site){
			lift(sender_site.state.command_log, 
					command, sender_site.is_slave);
		}

		//update lifter
		for (var idx in context.neighbors){
			var neighbor = context.neighbors[idx];
			if (neighbor == sender_site)
				continue;
			var cloned = command.clone();
			neighbor.state.command_log.push(command.clone());
		}

		local_state.contents = command.apply(local_state.contents);
		context.did_replace_text(
				command.begin, command.end, command.diff)

		//Update last known neighbor site state revision to 
		//use it when send command.
		sender_site.state.revision+=1;

		for (var idx in context.neighbors){
			var neighbor = context.neighbors[idx];
			if (neighbor == sender_site){
				continue;
			}
			var command_to_send = command.clone();
			command_to_send.revision = neighbor.state.revision;
			neighbor.send(command_to_send.encode());
		}
	}

	//For automatic test.
	context.do_random_action = function(){
		var len = context.local_site.state.contents.length;
		var c_table = 
			"abcdefghijklmnopqrstuvwxyz"
			"ABCDEFGHIJKLMNOPQRSTUVWXYZ";
		var idx = Math.floor(Math.random()*len);
		var c_idx = Math.floor(Math.random()*c_table.length);
		context.request_replace_text(idx, idx, c_table[c_idx]);
	}

	context.did_replace_text = function(begin, end, diff){
		//Overrideen by subclasses.
	}
	context.request_replace_text = function(begin, end, diff){
		var command = Command();
		command.begin = begin;
		command.end = end;
		command.diff = diff;

		context.execute_command(command.encode(), context.local_site);
	}
	return context;
}


