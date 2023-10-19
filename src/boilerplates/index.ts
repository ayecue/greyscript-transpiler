import { ASTChunkGreyScript, Parser } from 'greyscript-core';

export const HEADER_BOILERPLATE: ASTChunkGreyScript = new Parser(
  `MODULES={}
	EXPORTED={}
	__REQUIRE=function(r)
	if (not MODULES.hasIndex(r)) then
	exit("Module "+r+" cannot be found...")
	end if
	module=@MODULES[r]
	return @module(r).exports
	end function`
).parseChunk() as ASTChunkGreyScript;

export const MODULE_BOILERPLATE: ASTChunkGreyScript = new Parser(
  `MODULES["$0"]=function(r)
	module={}
	if (EXPORTED.hasIndex(r)) then
	module=EXPORTED[r]
	end if
	if (not module.hasIndex("exports")) then
	"$1"
	end if
	EXPORTED[r]=module
	return EXPORTED[r]
	end function`
).parseChunk() as ASTChunkGreyScript;

export const MAIN_BOILERPLATE: ASTChunkGreyScript = new Parser(
  `"$0"`
).parseChunk() as ASTChunkGreyScript;
