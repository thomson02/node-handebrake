#!/usr/bin/env node

var       fs = require( 'fs' )
  ,     path = require( 'path' )
  ,    child = require( 'child_process' )
  ,    spawn = child.spawn
  ,   mkdirp = require('mkdirp')

  ,  program = require( 'commander' )
  ,    charm = require( 'charm' )( process )
  ,   colors = require( 'colors/colors' )

  ,     exts = '3g2,3gp,aepx,ale,asf,asx,avi,avp,avs,bdm,bik,bsf,camproj,cpi,divx,dmsm,dream,dvdmedia,dvr-ms,dzm,dzp,edl,f4v,fbr,fcproject,flv,hdmov,imovieproj,m2p,m2ts,mkv,mod,moi,mov,mpeg,mpg,mts,mxf,ogv,pds,prproj,psh,r3d,rcproject,rm,rmvb,scm,smil,sqz,srt,stx,swf,swi,tix,trp,ts,veg,vf,vob,vro,webm,wlmp,wmv,wtv,xvid,yuv'
  , toEncode = []
  ,    chrOk = String.fromCharCode( 10003 )
  ,  chrFail = String.fromCharCode( 10007 )
  , folder, progressBar, extRx, activeEncoder;

toEncode.size    = 0;
toEncode.encoded = 0;
toEncode.sizes   = [];

/**
 * Allow app to exit!
 **/
charm.on( '^C', process.exit );


/**
 * Program Options
 **/
program
	.version( '0.1' )
	.usage  ( '[options] folder' )

	.option ( '-R, --recursive'                , 'Recursively scan directory' )
	.option ( '-d, --delete'                   , 'Delete the original video on successful encoding' )
	.option ( '-f, --force'                    , 'Force over-write of existing files' )
	.option ( '-k, --keep'                     , 'Keep partially encoded files from encoding failures' )
	.option ( '-w, --watch'                    , 'Watch the folder indefinitely for new video files' )
	.option ( '-Z, --preset       <name>'      , 'Handbrake video preset (default: Normal)' )
	.option ( '-H, --handbrake    <path>'      , 'Path to handbrake-cli (default: /Applications/HandBrakeCLI)' )
	.option ( '-c, --cpu          <count>'     , 'Set CPU count (default: autodetected)', parseInt )
	.option ( '-x, --extensions   <extensions>', 'Comma-separated list of file extensions to process (default: [long list])')
	.option ( '-X, --outputext    <ext>'       , 'Extension for generated files (default: m4v)' )
	.option ( '-O, --outputfolder <folder>'    , 'Folder in which to place completed videos (default: same-as-original)' )
    .option ( '-s, --recreatestructure'        , 'Recreate input folder structure for output files (default: false)' )

    .parse  ( process.argv );


/**
 * Process arguments and start folder scan
 **/
process.nextTick( function(){
	folder = resolve( folder );

	program.outputext || ( program.outputext = 'm4v'                        );
	program.preset    || ( program.preset    = 'Normal'                     );
	program.handbrake || ( program.handbrake = '/Applications/HandBrakeCLI' );

	if( !fs.existsSync( program.handbrake ) ){ die( 'HandBrakeCLI not found' ); }

	extRx = new RegExp( '\\.(' +
		( program.extensions || exts )
			.replace( /,/ig, '|' )
		 + ')$', 'i' );

	if( program.outputfolder ){
		program.outputfolder = resolve( program.outputfolder );
	}

	scan( folder, program.recursive );
	encode();
});


folder = program.args[0];


/**
 * Display help when invalid arguments are passed in
 **/
if( !folder || ( program.args.length > 1 ) ){
	console.error( program.helpInformation() );
	die();
}


/**
 * Watch for process exit
 **/
process.on( 'exit', function(){
	activeEncoder && activeEncoder.abandon();
});


/**
 * Kill app with an optional death message
 **/
function die( msg ){
	msg && console.error( msg.red );
	process.exit();
}

/**
 * Resolve a folder or die
 **/
function resolve( folder ){
	if( folder.indexOf( '/' ) ){
		folder = path.join( process.cwd(), folder );
	}

	if( fs.existsSync( folder ) ){
		return folder;
	}else{
		die( 'Folder does not exist: '.red + folder.red.underline );
	}

	return folder;
}


/**
 * Scan folder seeking out any video files
 **/
function scan( folder, recursive ){
	var files = fs.readdirSync( folder )
	  , stat;

	for( var i=0, l=files.length; i<l; i++ ){
		var fPath = path.join( folder, files[i] );
		stat = fs.statSync( fPath )

		if( stat.isDirectory() ){
			if( recursive ){
				scan( fPath, true );
			}
		} else {
			if( extRx.test( fPath ) ){
				addFile( fPath, stat );
			}
		}
	}

	if( program.watch ){
		setTimeout( function(){
			scan( folder, recursive );
			encode();
		}, 3E5 ); // re-scan every 5 minutes
	}
}


/**
 * Add video file to queue
 **/
function addFile( path, stat ){
	toEncode.push( path );
	toEncode.sizes.push( stat.size );
	toEncode.size += stat.size;
	console.log( 'Found File: '.green + path.green.underline );
}


/**
 * Encode next file in queue
 **/
function encode(){
	// wait your turn!
	if( activeEncoder && activeEncoder.running ){ return ; }

	if( !toEncode.length ){
		return;
	}

	activeEncoder = new Encoder( toEncode.shift() );
}


/**
 * Core Prototypes
 **/
String.prototype.times = function( n ){
	return new Array( n+1 ).join( this );
};

String.prototype.sprintf = function(){
	var out = this
	  , i, l;

	for( i=0, l=arguments.length; i<l; i++){
		out = out.replace( '%s', arguments[i] );
	}

	return out;
};

Number.prototype.toPercent = function(){
	return (
		 + ( 0|this )
		 + '.'
		 + ((( 0|this%1*100 ) || 0 ) + 100 ).toString().substr(1)
		 + '%'
	);
};

Number.prototype.toTimeString = function(){
	var s = 0|this/1000
	  , m = 0|s/60%60
	  , h = 0|s/3600
	  , s = s%60;

	return (
		h ? h + ':' + ( 100 + m ).toString().substr(1) + ':' + ( 100 + s ).toString().substr(1) :
		m ? m + ':' + ( 100 + s ).toString().substr(1)                                          :
		s + 's'
	);
};


/**
 * File encoder
 **/
function Encoder( fPath ){
	this.startTime = Date.now();
	this.inPath    = fPath;
	this.inFile    = fPath.split( /(\/|\\)/ ).pop();
	this.inFolder  = fPath.replace( /[\/\\][^\/\\]+$/, '' );

    var fullOutputFolder = program.outputfolder;
    if (program.recreatestructure && program.outputfolder){
        fullOutputFolder = fullOutputFolder + this.inPath.replace(path.resolve(program.args[0]), "").replace(this.inFile, "");
        mkdirp(fullOutputFolder);
    }

    this.outPath   = path.join( fullOutputFolder || this.inFolder, this.inFile.replace( /\.[^\.]+$/, '' ) + '.' + program.outputext );
	this.size      = fs.statSync( fPath ).size;

	charm.write( 'Encoding: ' + this.inFile + ' ' );

	if( this.inPath === this.outPath ){
		return this.abandon( 'Source & Destination are the same' );
	}
	if( !program.force && fs.existsSync( this.outPath ) ){
		return this.abandon( 'Destination file already exists' );
	}

	this.drawProgress();

	var args = [];

	if( program.cpu ){ args.push( '-c', program.cpu ); }
	args.push( '-Z', program.preset );
	args.push( '-i', this.inPath  );
	args.push( '-o', this.outPath );

	this.started = true;
	this.encoder = spawn( program.handbrake, args );
	this.encoder.stdout.on( 'data', this.onChildData.bind( this ) );
	this.encoder       .on( 'exit', this.onChildExit.bind( this ) );
}

Encoder.prototype = {
	drawProgress : function( p ){
		p || ( p = 0 );
		var P = ( toEncode.encoded + this.size * p ) / toEncode.size; // progress of everything in queue
		var str = '  [%s %s] %s  ETA: %s    Queue ETA: %s'.sprintf(
			  '#'.times( 0|p/5 )
			, ' '.times( 0|( 104.99-p )/5 )
			, p.toPercent()
			, ( ( Date.now() - this.startTime ) * ( 100 / p - 1 ) ).toTimeString()
			, ( ( Date.now() - this.startTime ) * ( 100 / P - 1 ) ).toTimeString()
		);
		charm.write( str );
		this.charmLen = str.length;
		return this;
	}

	, clearProgress : function(){
		charm.left( this.charmLen || 0 ).erase( 'end' );
		return this;
	}

	, onChildData : function( data ){
		var pDone = parseFloat( /([\.0-9]+) %/.exec( data.toString() ) );

		this.clearProgress().drawProgress( pDone );
	}

	, onChildExit : function( code ) {
		if( code === 0 ){
			// Success!
			this.clearProgress().removeInfile().success();
			process.nextTick( encode );

		}else{
			this.abandon( 'Unknown error encoding ' );
			// Dunno
		}
		this.complete();
		this.exit();
	}

	, exit : function(){
		console.log( '' );
		return this;
	}

	, fail : function( msg ){
		charm.foreground( 'red' ).write( ' ' + chrFail + ' ' + msg ).foreground( 'white' );
		return this;
	}

	, complete : function(){
		toEncode.encoded += this.size;
		return this;
	}

	, success : function(){
		charm.foreground( 'green' ).write( ' ' + chrOk + ' Success!' ).foreground( 'white' );
		return this;
	}

	, abandon : function( msg ){
		if( this.abandoned ){ return this; }
		this.clearProgress();
		this.encoder && this.encoder.kill();
		this.removeOutfile();

		// start next encoder -- nextTick in case abandon is called due to process.exit
		process.nextTick( encode );
		this.abandoned = true;

		return this.fail( msg ).exit();
	}

	, removeOutfile : function(){
		!program.keep && this.started && fs.existsSync( this.outPath ) && fs.unlinkSync( this.outPath );
		return this;
	}

	, removeInfile : function(){
		program.delete && fs.existsSync( this.inPath ) && fs.unlinkSync( this.inPath );
		return this;
	}
};