
JSOTC = function(){

var memcpy_ArrayBuffer = function(
		from_value, from_offset, byte_size, 
		to_value, to_offset){
	var from_view = new DataView(from_value);
	var to_view = new DataView(to_value);

	var i;
	for (i = 0; i<byte_size; i++){
		from_view.getUint8(from_offset+i);
		to_view.setUint8(to_offset+i, from_view.getUint8(from_offset+i));
	}
}

var concat_ArrayBuffer = function(l_value, r_value){
	var out = new ArrayBuffer(l_value.byteLength+r_value.byteLength);
	memcpy_ArrayBuffer(l_value, 0, l_value.byteLength, out, 0);
	memcpy_ArrayBuffer(r_value, 0, r_value.byteLength, 
			out, l_value.byteLength);
	return out;
}

var encode_string = function(str){
	var text_encoder = new TextEncoder("utf8");
	var encoded_str = text_encoder.encode(str);
	
	var str_len = encoded_str.byteLength;
	var h_len;
	if (str_len < 0xfe)
		h_len = 1;
	else if (str_len < 0x10000)
		h_len = 3;
	else
		h_len = 9;

	var out = new ArrayBuffer(h_len + str_len);
	var out_view = new DataView(out);
	
	if (str_len < 0xfe)
		out_view.setUint8(0, str_len);
	else if (str_len < 0x10000){
		out_view.setUint8(0, 0xFE);
		out_view.setUint16(1, str_len, false);
	}
	else{
		out_view.setUint8(0, 0xFF);
		out_view.setUint32(1, 0, false);
		out_view.setUint32(5, str_len, false);
	}

	memcpy_ArrayBuffer(encoded_str.buffer, 0, encoded_str.byteLength, 
			out, h_len);

	return out;
}

var decode_string = function(buffer, offset){
	var r_value = {};

	var data_view = new DataView(buffer, offset);

	//Get length of string
	var length = data_view.getUint8(0);
	var ptr = 1;
	if (length == 0xFE){
		length = data_view.getUint16(1, false);
		ptr += 2;
	}
	else if (length == 0xFF){
		length = data_view.getUint32(5, false);
		ptr += 8;
	}

	//Decode string.
	var string_array_buffer = new ArrayBuffer(length);
	memcpy_ArrayBuffer(buffer, offset+ptr, length,
			string_array_buffer, 0);
	var text_decoder = new TextDecoder('utf8');

	//Setup return value;
	r_value.string = text_decoder.decode(string_array_buffer);
	r_value.end = offset + ptr + length;
	return r_value;
}

Command = function(){
	//Constructor.
	//Return new command whitch does noting.
	var command = {};
	//A Target contents revision number.
	command.revision = 0;
	//A sender site.
	command.sender = null;

	command.clone = function(){
		//Return copy of itself.
		var cloned = Command();
		cloned.revision = command.revision
		cloned.sender = command.sender;

		return cloned;
	}

	command.encode = function(){
		//Return encoded command as ArrayBuffer.
		//Command.decode(command.encode()) must be equal to original.
		var r_value = new ArrayBuffer(0);
		return r_value;
	}

	command.apply = function(contents){
		//Return new contents with the command applied to old contents.
		return contents;
	}

	command.is_valid = function(contents){
		//Return true if command is valid and executable against contents.
		return true;
	}

	return command;
}

Command.decode = function(data_block){
	//Return new command instance.
	var command = Command();
	return command;
}

Command.apply_transform = function(
		command_0, 
		command_1, 
		is_prioritied){
	//For any commands "a" and "b", "apply transform" must satisfy
	//Command.apply_transform(b, a).apply(b.apply(c))
	// = Command.apply_transform(a, b).apply(a.apply(c))
	//where "c" is a contents.

	//command_0 are already executed at local environment
	//transform command_1

	//command_0: Command witch executed at same revision as command_1.
	//command_1: Target command to tronsformed
	//is_prioritized: Set True if transforming at server.
	//This parametor will affect order of inserted text at 
	//exactory same location
}

function NewContextWithCommandClass(context, command_class){
	var command_class = command_class;
	function State(){
		var state = {};
		state.command_log = [];
		state.log_offset = 0;
		state.revision = 0;
		return state;
	}

	context.on_init_local_site = function(site){
		site.state = State();
		if ("initial_contents" in context)
			site.state.contents = context.initial_contents();
		else
			site.state.context = null;
	}

	context.on_init_neighbor_site = function(site){
		site.state = State();
		if (site.is_slave){
			var state = context.local_site.state.contents;
			var command = Command.clone_state(state);
			site.send(command.encode());
			site.state.command_log.push(command.clone());
		}
	}

	function lift(command_log, command, is_prioritized){
		for (i = command.revision; i<command_log.length; i++){
			var cmd = command_log[i]
			if (cmd.sender == command.sender)
				continue;

			var clone = command.clone();
			command_class.apply_transform(
					command_log[i], command, !is_prioritized);
			command_class.apply_transform(
					clone, command_log[i], is_prioritized);
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
		context.did_execute_command(command);

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
		var command = command_class.random(
				context.local_site.state.contents);
		context.request_execute_command(command);
	}

	if (! "did_execute_command" in context){
		context.did_execute_command = function(command){
			//Overrideen by subclasses.
		}
	}

	if (! "will_execute_command" in context){
		context.will_execute_command = function(command){
			//Overrideen by subclasses.
			return true;
		}
	}

	context.request_execute_command = function(command){
		context.execute_command(command.encode(), context.local_site);
	}

	context.request_replace_text = function(begin, end, diff){
		var command = Command();
		command.begin = begin;
		command.end = end;
		command.diff = diff;

	}
	return context;
}

function NewContext(context){
	NewContextWithCommandClass(Command);
}

var that = {};
that.Command = Command;
that.NewContextWithCommandClass = NewContextWithCommandClass;
that.NewContext = NewContext;

that.encode_string = encode_string;
that.decode_string = decode_string;
that.memcpy_ArrayBuffer = memcpy_ArrayBuffer;

return that;

}();//poseud namespace
