

JSONType = {}
JSONType.Object = 0;
JSONType.Array = 1;
JSONType.Number = 2;
JSONType.String = 3;
JSONType.True = 4;
JSONType.False = 5;
JSONType.Null = 6;
JSONType.NoValue= 7;

JSONType.of = function(value){
	
}

function is_string(value){
	return (typeof value == "string") || (value instanceof String);
}

function escape_json_str(str){
	//fixme: fix this.
	return str;
}

TypeUtil = {}
TypeUtil.is_string = function(value){
	return Object.prototype.toString.call(value) === '[object String]';
};
TypeUtil.is_object = function(value){
	return Object.prototype.toString.call(value) === '[object Object]';
};
TypeUtil.is_array = function(value){
	return Object.prototype.toString.call(value) === '[object Array]';
};
TypeUtil.is_number = function(value){
	return Object.prototype.toString.call(value) === '[object Number]';
};
TypeUtil.is_bool = function(value){
	return Object.prototype.toString.call(value) === '[object Boolean]';
};
TypeUtil.is_null = function(value){
	return Object.prototype.toString.call(value) === '[object Null]';
};

TypeUtil.path_to_stack = function(root, path){
	var i;
	var stack = [root];
	for (i = 0; i<path.length; i++){
		var path_element = path[i];
		var previous = stack[i];
		var value = null;
		if (previous == null){
			//Do nothing when it's null.
		}
		else if (previous.hasOwnProperty(path_element)){
			value = previous[path_element];
		}
		stack.push(value);
	}
	return stack;
};

TypeUtil.random_path = function(root){
	var path = [];
	var target = root;
	
	while(1){
		if (TypeUtil.is_array(target)){
			var idx = Math.floor(Math.random()*target.length);
			path.push[idx];
			target = target[idx];
		}
		else if (TypeUtil.is_object(target)){
			var count = 0;
			var keys = [];
			for (key in target){
				if (target.hasOwnProperty(key))
					keys.push(key);
			}

			var idx = Math.floor(Math.random()*keys.length);
			var key = keys[idx];
			path.push[key];
			target = target[key];
		}
		else{
			break;
		}
	}
	
	var cut_off_idx = Math.floor(Math.random()*path.length);
	return path.slice(0, cut_off_idx);
}

function EventHolder(){
	var eventHolder= {};
	eventHolder.childs = {};
	
	//events
	eventHolder.will_modify = function(){};
	eventHolder.did_modify = function(){};

	eventHolder.at = function(path){

	}
	eventHolder.path_to_stack = function(path){
		var i;
		var stack = [eventHolder];
		for (i = 0; i<path.length; i++){
			var path_element = path[i];
			var previous = stack[i];
			var value = null;
			if (previous == null){
				//Do nothing when it's null.
			}
			else if (previous.childs.hasOwnProperty(path_element)){
				value = previous.value[path_element];
			}
			stack.push(value);
		}
		return stack;
	}

	return eventHolder;
}

function State(){
	var state = {};

	state.root = null;
	state.root_event = EventHolder();
	
	return state;
}



//Be careful at replacing root object.
function op_set(state, path, value){

	if (path.length == 0){
		state.root = value;
		return;
	}

	var stack = TypeUtil.path_to_stack(state.root, path);
	var event_stack = state.root_event.path_to_stack(path);
	var container = stack[stack.length - 2];
	//var event_container = event_stack[stack.length - 2];
	var key = path[path.length -1];
	if (container == null){
		//Invalid path.
		return;
	}
	else if (TypeUtil.is_array(container)){
		if (! TypeUtil.is_number(key)){
			//Invalid key.
			return;
		}
		if (key < 0 && key >= container.length){
			//Invalid range.
			return;
		}
		//trigger "will set"
		container.value[key] = value;
		//trigger "did set"
	}
	else if (TypeUtil.is_object(container)){
		if (! TypeUtil.is_string(key)){
			//Invalid key.
			return;
		}
		//var had_old_value = container.hasOwnProperty(key);
		//trigger "will set"
		container[key] = value;
		//trigger "did set"
	}
	else{
		//Invalid type.
		return;
	}
}

function op_delete(state, path){
	if (path.length == 0){
		//Invalid path
		return;
	}

	var stack = TypeUtil.path_to_stack(state.root, path);
	var event_stack = state.root_event.path_to_stack(path);
	var container = stack[stack.length - 2];
	//var event_container = event_stack[stack.length - 2];
	var key = path[path.length -1];
	if (container == null){
		//Invalid path.
		return;
	}
	else if (TypeUtil.is_object(container)){
		if (! TypeUtil.is_string(key)){
			//Invalid key.
			return;
		}
		var had_old_value = container.hasOwnProperty(key);
		if (! had_old_value){
			//Invalid key.
		}
		//trigger "will delete"
		delete container[key];
		//trigger "did delete"
	}
	else{
		//Invalid type.
		return;
	}

}

function op_splice(state, path, begin, end, values){
	if (path.length == 0){
		//Invalid path
		return;
	}

	var stack = TypeUtil.path_to_stack(state.root, path);
	var event_stack = state.root_event.path_to_stack(path);
	//var container = stack[stack.length - 2];
	var old_value = stack[stack.length - 1];
	//var event_container = event_stack[stack.length - 2];
	if (old_value == null){
		//Invalid path.
		return;
	}
	else if (!(TypeUtil.is_array(old_value)||
				TypeUtil.is_string(old_value))){
		//Invalid type.
		return;
	}
	else{
		var length = old_value.length;
		var test_result = false;
		test_result = test_result||(begin > length);
		test_result = test_result||(end > length);
		test_result = test_result||(begin > end);
		test_result = test_result||(begin < 0);
		test_result = test_result||(end < 0);

		if (test_result){
			//Invalid range.
			return;
		}

		if (TypeUtil.is_array(old_value) && ! TypeUtil.is_array(values)){
			//Invalid value;
			return;
		}
		if (TypeUtil.is_string(old_value) && ! TypeUtil.is_string(values)){
			//Invalid value;
			return;
		}
		
		var new_value = old_value.slice(0, begin).
				concat(values, old_value.slice(end));
		if (path.length == 0)//Modding root object.
			state.root = new_value;
		else
			stack[stack.length - 2][path[path.length-1]] = new_value;
	}
}

function CommandSet(){
	var command = {};
	command.type = CommandType.Set;
	command.path = [];
	command.value = null;
}

function CommandDelete(){
	var command = {};
	command.type = CommandType.Delete;
	command.path = [];
}

function CommandSplice(){
	var command = {};
	command.type = CommandType.Delete;
	command.path = [];
}

CommandType = {}
CommandType.Noop     = 0;
CommandType.Set      = 1;
CommandType.Delete   = 2;
CommandType.Splice   = 3;

CommandType.Begin    = 4;
CommandType.End      = 5;
CommandType.CD       = 6;
//CommandType.Merge    = 4;


function Command(){
	var command = JSOTC.Command();
	command.type = CommandType.Noop;
	command.path = [];
	command.value = null;
	
	//For splice command
	command.begin = 0;
	command.end = 0;

	var base_clone = command.clone;
	command.clone = function(){
		var cloned = base_clone();
		cloned.path = command.path;
		cloned.value = command.value;
		cloned.begin = command.begin;
		cloned.end= command.end;
		return cloned;
	}

	command.encode = function(){

		var opcode_offset = 0xA0;
		var is_op_set = command.type == CommandType.Set;
		var is_op_delete = command.type == CommandType.Delete;
		var is_op_splice = command.type == CommandType.Splice;

		var total_length  = 0;
		total_length += 1;//op_code

		if (is_op_splice){
			total_length += 4;//begin and end field both take 2 byte.
		}
		
		var json_path
		var encoded_path

		if (is_op_set || is_op_delete || is_op_splice){
			json_path = JSON.stringify(command.path);
			encoded_path = JSOTC.encode_string(json_path);
			total_length += encoded_path.byteLength;
		}

		var json_value
		var encoded_value

		if (is_op_set || is_op_splice){
			json_value = JSON.stringify(command.path);
			encoded_value = JSOTC.encode_string(json_path);
			total_length += encoded_value.byteLength;
		}

		var r_value = new ArrayBuffer(total_length);
		var r_view = new DataView(r_value);

		var ptr = 0;
		r_view.setUint8(ptr, opcode_offset + command.type);
		ptr += 1;

		if (is_op_splice){
			r_view.setUint16(ptr, command.begin, false);
			ptr += 2;
			r_view.setUint16(ptr, command.end, false);
			ptr += 2;
		}

		if (is_op_set || is_op_delete || is_op_splice){
			JSONTC.memcpy_ArrayBuffer(
					encoded_path, 0, encoded_diff.byteLength,
					r_value, ptr);
			ptr += encoded_path.byteLength;
		}

		if (is_op_set || is_op_splice){
			JSONTC.memcpy_ArrayBuffer(
					encoded_value, 0, encoded_value.byteLength,
					r_value, ptr);
			ptr += encoded_value.byteLength;
		}

		return r_value;
	}

	command.apply = function(contents){
		if (command.type == CommandType.Set)
			op_set(contents, command.path, command.value);
		if (command.type == CommandType.Delete)
			op_delete(contents, command.path);
		if (command.type == CommandType.Splice){
			op_splice(contents, 
					command.path, 
					command.begin, command.end, 
					command.value);
		}
		return contents;
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

Command.random = function(contents){
	function create_random_string(length){
		//fixme: support multi-byte charctor.

		var c_table = 
			"abcdefghijklmnopqrstuvwxyz"
			"ABCDEFGHIJKLMNOPQRSTUVWXYZ";
		var c_out = "";
		var i;
		for (i = 0; i<length; i++){
			var c_idx = Math.floor(Math.random()*c_table.length);
			c_out += c_table[c_idx]
		}
		return c_out;
	}

	function create_random_array(depth, item_count){
		var i;
		var value = {};
		for (i = 0; i<item_count; i++){
			var e_key = create_random_string(
					Math.floor(Math.random()*20));
			var e_value= create_json_fragment(depth-1);
			
			value[e_key] = e_value;
		}
		return value;
	}

	function create_random_object(depth, item_count){
		var i;
		var value = [];
		for (i = 0; i<item_count; i++){
			var e_value= create_json_fragment(depth-1);
			value.push(e_value);
		}
		return value;
	}

	function create_json_fragment(depth){
		if (depth == 0){
			return null;	
		}
		if (depth == 1){
			var rnd = Math.random();
			if (rnd < 0.1){
				return true;
			}
			else if (rnd < 0.2){
				return false;
			}
			else if (rnd < 0.3){
				return null;
			}
			if (rnd < 0.6){
				var rnd_2 = Math.random()*10+10;
				return create_random_string(Math.floor(rnd_2));
			}
			else if (rnd < 0.8){
				var rnd_2 = Math.random()*1000-500;
				return Math.floor(rnd_2);
			}
			else{
				var rnd_2 = Math.random()*1000-500;
				return rnd_2;
			}
		}
		else{
			var rnd = Math.random();
			if (rnd < 0.4){
				var item_count = Math.floor(Math.random()*20);
				return create_random_array(depth, item_count);
			}
			else if (rnd < 0.8){
				var item_count = Math.floor(Math.random()*20);
				return create_random_object(depth, item_count);
			}
			else{
				return create_json_fragment(1);
			}
		}
	}

	var command = Command();

	var root = contents.root;
	var path = TypeUtil.random_path(root);
	if (path.length == 0 && root == null){
		command.type = CommandType.Set;
		command.path = path;
		command.value = create_json_fragment(5);
		return command;
	}

	var stack = TypeUtil.path_to_stack;
	var target = stack[stack.length -1];

	var rnd = Math.random();

	var container = null;
	if (stack.length > 2)
		container = stack[stack.length -2];

	var is_deletable = TypeUtil.is_object(container);
	var is_splicable = TypeUtil.is_array(target) || 
						TypeUtil.is_string(target);
	var is_settable = true;
	if (rnd < 0.1 && is_deletable){
		command.type = CommandType.Delete;
		command.path = path;
		return command;
	}
	else if (rnd < 0.7 && is_splicable){
		var target_length = target.length;
		var len = Math.floor(Math.random()*target_length);
		var begin = Math.floor(Math.random()*target_length);
		command.type = CommandType.Splice;
		command.path = path;
		command.begin = begin;
		command.end = Math.min(begin+len, target_lengt);

		var insert_count = command.end - command.begin;
		insert_count = Math.max(0, 
				insert_count-5+Math.floor(Math.random()*10));
		if (TypeUtil.is_string(target)){
			command.value = create_random_string(insert_count);
		}
		else if (TypeUtil.is_array(target)){
			var rnd_2 = Math.floor(Math.random()*10+10);
			command.value = create_random_array(
					Math.max(0, 4-path.length), insert_count);
		}
		return command;
	}
	else if (is_settable){
		command.type = CommandType.Splice;
		command.path = path;
		command.value = create_json_fragment(
				Math.max(0, 4-path.length));
		return command;
	}
	else{
		//something wrong
	}
}

Command.decode = function(data_block){
	var command = Command();

	var opcode_offset = 0xA0;
	var dataview = new DataView(data_block);
	
	var ptr = 0;
	var op_code = dataview.getUint8(ptr);
	ptr += 1;
	command.type = op_code - opcode_offset;

	var is_op_set = command.type == CommandType.Set;
	var is_op_delete = command.type == CommandType.Delete;
	var is_op_splice = command.type == CommandType.Splice;

	if (is_op_splice){
		command.begin = dataview.getUint16(ptr);
		ptr += 2;
		command.end= dataview.getUint16(ptr);
		ptr += 2;
	}

	if (is_op_set || is_op_delete || is_op_splice){
		var result = JSOTC.decode_string(data_block, ptr);
		command.path = result.string;
		ptr = result.end;
	}
	if (is_op_set || is_op_splice){
		var result = JSOTC.decode_string(data_block, ptr);
		command.value = result.string;
		ptr = result.end;
	}

	return command;
}


//command_0 are already executed at local environmentc
//transform command_1

//command_0: Command witch executed at same revision as command_1.
//command_1: Target command to tronsformed
//is_prioritized: Set True if transforming at server.
//This parametor will affect order of inserted text at 
//exactory same location

Command.apply_transform = function(
		command_0, 
		command_1, 
		is_prioritied){
	if (command_0.type == CommandType.Noop){
		return;//Nothing required.
	}
	else if (command_1.type == CommandType.Noop){
		return;//Nothing required.
	}

	var i = 0;
	var is_0_ancestor_of_b = false;
	var min_path_length = Math.min(
			command_0.path.length,
			command_1.path.length);
	var max_path_length = Math.max(
			command_0.path.length,
			command_1.path.length);

	for (i = 0; i<min_path_length; i++){
		if (command_0.path[i] !== command_1.path[i]){
			break;
		}
	}

	var cond_0 = 
		(command_0.type in [
			CommandType.Set, CommandType.Delete, CommandType.Splice])&&
		(command_1.type in [
			CommandType.Set, CommandType.Delete, CommandType.Splice]);
	if (! cond_0){
		//Maybe something wrong.
		return;
	}
	var is_same_path = (i == max_path_length);
	var is_sibling = (i < min_path_length);
	var is_0_ancestor_of_1 = false;
	var is_0_descendant_of_1 = false;
	if ((! is_same_path) && (i == min_path_length)){
		is_0_ancestor_of_1 = (i == command_0.path.length);
		is_0_descendant_of_1 = (i == command_1.path.length);
	}

	if (is_sibling){
		return;//Nothing required?
	}
	if (is_same_path){
		//Set + Set
		if (command_0.type == CommandType.Set && 
				command_1.type == CommandType.Set){
			if (is_prioritied){
				command_1.type = CommandType.Noop;
			}
		}
		//Delete + Delete
		if (command_0.type == CommandType.Delete && 
				command_1.type == CommandType.Delete){
			command_1.type = CommandType.Noop;
		}
		//Splice + Splice
		if (command_0.type == CommandType.Splice && 
				command_1.type == CommandType.Splice){
			Command.apply_splice_transform(
					command_0, command_1, is_prioritied);
		}

		//Delete + Set
		if (command_0.type == CommandType.Set && 
				command_1.type == CommandType.Delete){
			return;//Nothing required. Delete wins.
		}
		if (command_0.type == CommandType.Delete && 
				command_1.type == CommandType.Set){
			command_1.type = CommandType.Noop;
			//Delete wins.
			return;
		}

		//Set + Splice
		if (command_0.type == CommandType.Set && 
				command_1.type == CommandType.Splice){
			command_1.type = CommandType.Noop;
			//Set wins.
			return;
		}
		if (command_0.type == CommandType.Splice && 
				command_1.type == CommandType.Set){
			return;//Nothing required. Set wins.
		}

		//Delete + Splice
		if (command_0.type == CommandType.Splice && 
				command_1.type == CommandType.Delete){
			return;//Nothing required. Delete wins.
		}
		if (command_0.type == CommandType.Delete && 
				command_1.type == CommandType.Splice){
			command_1.type = CommandType.Noop;
			//Delete wins.
			return;
		}
		return;
	}
	if (is_0_ancestor_of_1){
		//Set + Set or Delete + Delete
		if (command_0.type == CommandType.Splice){
			var begin = command_0.begin;
			var end = command_0.end;
			var index = command_1.path[command_0.path.length];
			if (! TypeUtil.is_number(index)){
				//Something is wrong. One of them must be invalid command.
				//Let it solved by letar stage.
				return;
			}
			if (index < begin){
				return;
			}
			else if (index <= end){
				command_1.type = CommandType.Noop;
				return;
			}
			else{
				var length = 1;
				command_1.path[command_0.path.length] += 
					command_0.value.length-(end-begin);
				return;
			}
			return;
		}
		//Not Splice + Any
		{
			//Disable command on Descendant.
			command_1.type = CommandType.Noop;
			return;
		}
		return;
	}
	if (is_0_descendant_of_1){
		//Nothing required.
		return;
	}
}

Command.apply_splice_transform = function(
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

function NewContext(context){
	context.initial_contents = function(){
		return "";
	}
	context.did_execute_command = function(command){
		context.did_replace_text(command.begin, command.end, command.diff);
	}

	JSOTC.NewContextWithCommandClass(context, Command);

	context.request_replace_text = function(begin, end, diff){
		var command = Command();
		command.begin = begin;
		command.end = end;
		command.diff = diff;

		context.request_execute_command(command);
	}

	context.did_replace_text = function(begin, end, diff){
		//Overrideen by subclasses.
	}

	return context;	
}

function test(){
	var state = State();
	op_set(state, [], {});
	op_set(state, ["a"], "a");
	op_set(state, ["b"], 1);
	op_set(state, ["b"], 2);
	op_set(state, ["c"], []);
	//console.log(state);

	op_splice(state, ["c"], 0, 0, ["b"]);
	op_splice(state, ["c"], 1, 1, ["c"]);
	op_splice(state, ["c"], 2, 2, ["d"]);
	op_splice(state, ["c"], 0, 1, ["e"]);

	op_delete(state, ["b"]);

	op_splice(state, ["c"], 0, 0, ["test"]);
	op_splice(state, ["c", 0], 0, 0, "test2+");
	console.log(state);

	state = State();

	var i;
	for (i = 0; i<100; i++){
		var command = Command.random(state);
		state = command.apply(state);
	}
	console.log(state);
}
test();

//test sequence

//set null {}
//set ["a"] "a"
//set ["b"] 1
//set ["b"] 2
//set ["c"] []
//replace ["c"] 0 0 ["b"]
//replace ["c"] 1 1 ["c"]
//replace ["c"] 2 2 ["d"]
//replace ["c"] 0 1 ["e"]
//delete ["b"]

