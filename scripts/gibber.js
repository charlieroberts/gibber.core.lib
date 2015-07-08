(function() {
//"use strict" 
// can't use strict because eval is used to evaluate user code in the run method
// I should wrap this in a Function call instead...
var $ = require( './dollar' )

var Gibber = {
  dollar: $,
  Presets: {},
  scale : null,
  minNoteFrequency:50,
  started:false,
  outputCurves : {
    LINEAR:0,
    LOGARITHMIC:1
  },
  Pattern: require( './pattern' ),
  
  export: function( target ) {
    Gibber.Utilities.export( target )
    target.Pattern = Gibber.Pattern 
    target.Score = Gibber.Score
    target.Euclid = Gibber.Euclid
    
    if( Gibber.Audio ) {
      Gibber.Audio.export( target )
    }
    
    if( Gibber.Graphics ) {
      Gibber.Graphics.export( target )
    }
    
    if( Gibber.Interface ) {
      Gibber.Interface.export( target )
    }
    
    if( Gibber.Communication ) { 
      Gibber.Communication.export( target )
    }
  },
  
  init: function( _options ) {                        
      if( typeof window === 'undefined' ) { // check for node.js
        window = GLOBAL // is this a good idea? makes a global window available in all files required in node
        document = GLOBAL.document = false
      }else if( typeof GLOBAL !== 'undefined' ) { // I can't remember why I put this in there...
        if( !GLOBAL.document ) document = GLOBAL.document = false
      }
      
      var options = {
        globalize: true,
        canvas: null,
        target: window,
        graphicsMode:'3d'
      }
      
      if( typeof _options === 'object' ) $.extend( options, _options )
      
      Gibber.Pattern = Gibber.Pattern( Gibber )
      if( Gibber.Audio ) {
        Gibber.Audio.init() 
      
        if( options.globalize ) {
          //options.target.Master = Gibber.Audio.Master    
        }else{
          var _export = Gibber.export.bind( Gibber )
          $.extend( Gibber, Gibber.Audio )
          Gibber.export = _export
        }        
      }
      
      if( Gibber.Graphics ) {
        // this happens dynamically when a graphics object is first created to save CPU
        // Gibber.Graphics.init( options.graphicsMode ) 
      }
      
      if( Gibber.Interface ) {}
      
      if( options.globalize ) {
        Gibber.export( options.target )
      }
      
      options.target.$ = $ // TODO: geez louise
            
      Gibber.Utilities.init()
      
      // Gibber.isInstrument = true
  },
  // interfaceIsReady : function() {
  //   if( !Gibber.started ) {
  //     if( typeof Gibber.Audio.context.currentTime !== 'undefined' ) {
  //       Gibber.started = true
  //       if( Gibber.isInstrument ) eval( loadFile.text )
  //     }
  //   }
  // },
  Modules : {},
 	import : function( path, exportTo, shouldSave ) {
    var _done = null
    console.log( 'Loading module ' + path + '...' )

    if( path.indexOf( 'http:' ) === -1 ) { 
      console.log( 'loading via post', path )
      $.post(
        Gibber.Environment.SERVER_URL + '/gibber/'+path, {},
        function( d ) {
          d = JSON.parse( d )
                              
          var f = new Function( 'return ' + d.text )
          
          Gibber.Modules[ path ] = f()
          
          if( exportTo && Gibber.Modules[ path ] ) {
            $.extend( exportTo, Gibber.Modules[ path ] )
            //Gibber.Modules[ path ] = exportTo
          }
          if( Gibber.Modules[ path ] ) {
            if( typeof Gibber.Modules[ path ].init === 'function' ) {
              Gibber.Modules[ path ].init()
            }
            if( typeof Gibber.Modules[ path ] === 'object' ) {
              Gibber.Modules[ path ].moduleText = d.text
            }
            console.log( 'Module ' + path + ' is now loaded.' )
          }else{
            console.log( 'Publication ' + path + ' is loaded. It may not be a valid module.')
          }
          
          if( _done !== null ) { _done( Gibber.Modules[ path ] ) }

          return false;
        }
      )
    }else{
      var script = document.createElement( 'script' )
      script.src = path
      
      script.onload = function () {
        console.log( 'Module ' + path + ' is now loaded.' )
        if( _done !== null ) { _done() }
      };

      document.head.appendChild( script )
    }
    return { done: function( fcn ) { _done =  fcn } }
 	},  
  
  // log: function( msg ) { 
  //   //console.log( "LOG", typeof msg )
  //   if( typeof msg !== 'undefined' ) {
  //     if( typeof msg !== 'function') {
  //       console.log( msg )
  //     }else{
  //       console.log( 'Function' )
  //     }
  //   }
  // },
  
  scriptCallbacks: [],
  
  run: function( script, pos, cm ) { // called by Gibber.Environment.Keymap.modes.javascript
		var _start = pos.start ? pos.start.line : pos.line,
				tree
    
	  try{
			tree = Gibber.Esprima.parse(script, { loc:true, range:true} )
		}catch(e) {
			console.error( "Parse error on line " + ( _start + e.lineNumber ) + " : " + e.message.split(':')[1] )
			return
		}
    
    // must wrap i with underscores to avoid confusion in the eval statement with commands that use proxy i
    for( var __i__ = 0; __i__ < tree.body.length; __i__++ ) {
      var obj = tree.body[ __i__ ],
					start = { line:_start + obj.loc.start.line - 1, ch: obj.loc.start.column },
					end   = { line:_start + obj.loc.end.line - 1, ch: obj.loc.end.column },
				  src   = cm.getRange( start, end ),
          result = null
			
			//console.log( start, end, src )
			try{
				result = eval( src )
        if( typeof result !== 'function' ) {
          log( result )
        }else{
          log( 'Function' )
        }
			}catch( e ) {
				console.error( "Error evaluating expression beginning on line " + (start.line + 1) + '\n' + e.message )
			}
      
      if( this.scriptCallbacks.length > 0 ) {
        for( var ___i___ = 0; ___i___ < this.scriptCallbacks.length; ___i___++ ) {
          this.scriptCallbacks[ ___i___ ]( obj, cm, pos, start, end, src, _start )
        }
      }
    }
  },
  
  processArguments: function(args, type) {    
    var obj
    
    if( args.length ) {
      if( typeof args[0] === 'string' && type !== 'Drums' && type !== 'XOX' ) {
        obj = Gibber.getPreset( args[0], type )
        
        if( typeof args[1] == 'object' ) {
          $.extend( obj, args[ 1 ] )
        }
        return obj
      }
      return Array.prototype.slice.call(args, 0)
    }
    
    return obj
  },
  
  processArguments2 : function(obj, args, type) {
    if( args.length ) {
      var firstArg = args[ 0 ]
    
      if( typeof firstArg === 'string' && type !== 'Drums' && type !== 'XOX' && type !== 'Shader' ) {
        preset = Gibber.getPreset( args[0], type )
      
        if( typeof args[1] === 'object' ) {
          $.extend( preset, args[ 1 ] )
        }
      
        $.extend( obj, preset )
        
        //if( obj.presetInit ) obj.presetInit() 
      }else if( $.isPlainObject( firstArg ) && typeof firstArg.type === 'undefined' ) {
        $.extend( obj, firstArg )
      }else{
        var keys = Object.keys( obj.properties )
                
        if( obj.type === 'FX' ) {
          for( var i = 0; i < args.length; i++ ) { obj[ keys[ i + 1 ] ] = args[ i ] }
        }else{
          for( var i = 0; i < args.length; i++ ) { obj[ keys[ i ] ] = args[ i ] }
        }
        
      }
    }      
  },
    
  getPreset: function( presetName, ugenType ) {
    var obj = {}
    
    if( Gibber.Presets[ ugenType ] ) {
      if( Gibber.Presets[ ugenType ][ presetName ] ) {
        obj = Gibber.Presets[ ugenType ][ presetName ]
      }else{
        Gibber.log( ugenType + ' does not have a preset named ' + presetName + '.' )
      }
    }else{
      Gibber.log( ugenType + ' does not have a preset named ' + presetName + '.' )
    }
    
    return obj
  },
  
  clear : function() {
    var args = Array.prototype.slice.call( arguments, 0 )
    if( Gibber.Audio ) Gibber.Audio.clear.apply( Gibber.Audio, args );
    
    if( Gibber.Graphics ) Gibber.Graphics.clear( Gibber.Graphics, args )

    //Gibber.proxy( window, [ a ] )
    Gibber.proxy( window )
		
    $.publish( '/gibber/clear', {} )
        
    console.log( 'Gibber has been cleared.' )
  },
  
  singleton: function( lt, target ) {
    if( !target ) target = window 
    
    if( $.isArray( lt ) ) {
      for( var i = 0; i < lt.length; i++ ) {
        Gibber.singleton( lt[ i ], target )
      }
      return
    }
    
    if( typeof target[ lt ] !== 'undefined' ) { //&& arguments[1].indexOf( window[ lt ] ) === -1 ) { 
      delete target[ lt ] 
      delete target[ '___' + lt ]
    }

		var ltr = lt;
  
		Object.defineProperty( target, ltr, {
      configurable: true,
			get:function() { return target[ '___'+ltr] },
			set:function( newObj ) {
        if( newObj ) {
          if( target[ '___'+ltr ] ) { 
            if( typeof target[ '___'+ltr ].replaceWith === 'function' ) {
              target[ '___'+ltr ].replaceWith( newObj )
              console.log( target[ '___'+ltr ].name + ' was replaced with ' + newObj.name )
            }
          }
          target[ '___'+ltr ] = newObj
        }else{
				  if( target[ '___'+ltr ] ) {
				  	 var variable = target[ '___'+ltr ]
				  	 if( variable ) {
				  		 if( typeof variable.kill === 'function' /*&& target[ '___'+ltr ].destinations.length > 0 */) {
				  			 variable.kill();
				  		 }
				  	 }
				  }
        }
      }
    });
  },
  proxy: function( target ) {
		var letters = "abcdefghijklmnopqrstuvwxyz"
    
		for(var l = 0; l < letters.length; l++) {

			var lt = letters.charAt(l);
      Gibber.singleton( lt, target )
      
    }
  },

  construct: function( constructor, args ) {
    function F() {
      return constructor.apply( this, args );
    }
    F.prototype = constructor.prototype;
    return new F();
  },

  createMappingObject : function(target, from) {
    var min = typeof target.min === 'function' ? target.min() : target.min,
        max = typeof target.max === 'function' ? target.max() : target.max,
        _min = typeof from.min === 'function' ? from.min() : from.min,
        _max = typeof from.max === 'function' ? from.max() : from.max
    
    if( typeof from.object === 'undefined' && from.Value) { // if using an interface object directly to map
      from = from.Value
    }
    
    if( typeof target.object[ target.Name ].mapping !== 'undefined') {
      target.object[ target.Name ].mapping.replace( from.object, from.propertyName, from.Name )
      return
    }
    
    if( typeof from.targets !== 'undefined' ) {
      if( from.targets.indexOf( target ) === -1 ) from.targets.push( [target, target.Name] )
    }
    
    var fromTimescale = from.Name !== 'Out' ? from.timescale : 'audioOut' // check for audio Out, which is a faux property
        
    mapping = Gibber.mappings[ target.timescale ][ fromTimescale ]( target, from )
    
    //target.object[ target.name ].toString = function() { return '> continuous mapping: ' + from.name + ' -> ' + target.name }
    
    Object.defineProperties( target.object[ target.Name ], {
      'min' : {
        configurable:true,
        get : function() { return min },
        set : function(v) { min = v;  target.object[ target.Name ].mapping.outputMin = min }
      },
      'max' : {
        configurable:true,
        get : function() { return max },
        set : function(v) { max = v; target.object[ target.Name ].mapping.outputMax = max }
      },
    })
    
    target.object[ target.Name ].mappingObjects = []
    
    Gibber.createProxyProperty( target.object[ target.Name ], 'min', 1, 0, {
      'min':min, 'max':max, output: target.output,
      timescale: target.timescale,
      dimensions:1
    })
    
    Gibber.createProxyProperty( target.object[ target.Name ], 'max', 1, 0, {
      'min':min, 'max':max, output: target.output,
      timescale: target.timescale,
      dimensions:1
    })
    
    Object.defineProperties( from.object[ from.Name ], {
      'min' : {
        configurable:true,
        get : function() { return _min },
        set : function(v) { _min = v; target.object[ target.Name ].mapping.inputMin = _min }
      },
      'max' : {
        configurable:true,
        get : function() { return _max },
        set : function(v) { _max = v; target.object[ target.Name ].mapping.inputMax = _max }
      },
    })
    
    target.object[ target.Name ].invert = function() {
      target.object[ target.Name ].mapping.invert()
    }
    
    if( typeof target.object.mappings === 'undefined' ) target.object.mappings = []
    
    target.object.mappings.push( mapping )
    
    if( typeof from.object.mappings === 'undefined' ) from.object.mappings = []
    
    from.object.mappings.push( mapping )
    
    Gibber.defineSequencedProperty( target.object[ target.Name ], 'invert' )
        
    return mapping
  },
  
  defineSequencedProperty : function( obj, key, priority ) {
    var fnc = obj[ key ], seqNumber, seqNumHash = {}, seqs = {}

    if( !obj.seq && Gibber.Audio ) {
      obj.seq = Gibber.Audio.Seqs.Seq({ doNotStart:true, scale:obj.scale, priority:priority, target:obj })
    }
    
    fnc.seq = function( _v,_d, num ) {
      var seq
      if( typeof _v === 'string' && ( obj.name === 'Drums' || obj.name === 'XOX' || obj.name === 'Ensemble' )) {
        _v = _v.split('')
        if( typeof _d === 'undefined' ) _d = 1 / _v.length
      }
      
      if( typeof obj.seq === 'function' ) {
        obj.seq = obj.object.seq // cube.position etc. TODO: Fix this hack!
      }
      
      var v = $.isArray(_v) ? _v : [_v],
          d = $.isArray(_d) ? _d : typeof _d !== 'undefined' ? [_d] : null,
          args = {
            'key': key,
            values: [ Gibber.construct( Gibber.Pattern, v ) ],
            durations: d !== null ? [ Gibber.construct( Gibber.Pattern, d ) ] : null,
            target: obj,
            'priority': priority
          }

      
      if( typeof num === 'undefined' ) num = 0 // _num++
       
      if( typeof seqs[ num ] !== 'undefined' ) {
        seqs[ num ].shouldStop = true
        delete seqs[ num ]
        //obj.seq.seqs.splice( seqNumHash[ num ], 1 )
      }
            
      var valuesPattern = args.values[0]
      if( v.randomFlag ) {
        valuesPattern.filters.push( function() {
          var idx = Gibber.Utilities.rndi(0, valuesPattern.values.length - 1)
          return [ valuesPattern.values[ idx ], 1, idx ] 
        })
        for( var i = 0; i < v.randomArgs.length; i+=2 ) {
          valuesPattern.repeat( v.randomArgs[ i ], v.randomArgs[ i + 1 ] )
        }
      }

      if( d !== null ) {
        var durationsPattern = args.durations[0]
        if( d.randomFlag ) {
          durationsPattern.filters.push( function() { 
            var idx = Gibber.Utilities.rndi(0, durationsPattern.values.length - 1)
            return [ durationsPattern.values[ idx ], 1, idx ] 
          })
          for( var i = 0; i < d.randomArgs.length; i+=2 ) {
            durationsPattern.repeat( d.randomArgs[ i ], d.randomArgs[ i + 1 ] )
          }
        }
        
        durationsPattern.seq = obj.seq
      }
      
      valuesPattern.seq = obj.seq
      
      obj.seq.add( args )
      
      seqNumber = obj.seq.seqs.length - 1
      seqs[ num ] = seq = obj.seq.seqs[ seqNumber ]
      seqNumHash[ num ] = seqNumber   
      //seqNumber = d !== null ? obj.seq.seqs.length - 1 : obj.seq.autofire.length - 1
      //seqs[ seqNumber ] = d !== null ? obj.seq.seqs[ num ] : obj.seq.autofire[ num ]
      
      fnc[ num ] = {}
      
      Object.defineProperties( fnc[ num ], {
        values: {
          configurable:true,
          get: function() { 
            return valuesPattern
            /*
            if( d !== null ) { // then use autofire array
              return obj.seq.seqs[ seqNumber ].values[0]
            }else{
              return obj.seq.autofire[ seqNumber ].values[0]
            }*/
          },
          set: function( val ) {
            var pattern = Gibber.construct( Gibber.Pattern, val )
            
            if( !Array.isArray( pattern ) ) {
              pattern = [ pattern ]
            }

            if( d !== null ) {
              obj.seq.seqs[ seqNumber ].values = pattern
            }else{
              obj.seq.autofire[ seqNumber ].values = pattern
            }
          }
        },
        durations: {
          configurable:true,
          get: function() { 
            /*if( d !== null ) { // then it's not an autofire seq
              return obj.seq.seqs[ seqNumber ].durations[ 0 ] 
            }else{
              return null
            }*/
            return durationsPattern
          },
          set: function( val ) {
            if( !Array.isArray( val ) ) {
              val = [ val ]
            }
            //obj.seq.seqs[ seqNumber ].durations = val   //.splice( 0, 10000, v )
            var pattern = Gibber.construct( Gibber.Pattern, val )
            
            if( !Array.isArray( pattern ) ) {
              pattern = [ pattern ]
            }
            
            obj.seq.seqs[ seqNumber ].durations = pattern   //.splice( 0, 10000, v )
          },
        },
      })
      
      fnc[ num ].seq = function( v, d ) {
        fnc.seq( v,d, num ) 
      }
      
      if( !obj.seq.isRunning ) {
        obj.seq.offset = Gibber.Clock.time( obj.offset )
        obj.seq.start( true, priority )
      }
            
      fnc.seq.stop = function() { seqs[ seqNumber ].shouldStop = true } 
    
      // TODO: property specific stop/start/shuffle etc. for polyseq
      fnc.seq.start = function() {
        seqs[ seqNumber ].shouldStop = false
        obj.seq.timeline[0] = [ seq ]                
        obj.seq.nextTime = 0
      
        if( !obj.seq.isRunning ) { 
          obj.seq.start( false, priority )
        }
      }
    
      fnc.seq.repeat = function( numberOfTimes ) {
        var repeatCount = 0
      
        var filter = function( args, ptrn ) {
          if( args[2] % (ptrn.getLength() - 1) === 0 && args[2] !== 0) {
            repeatCount++
            if( repeatCount === numberOfTimes ) {
              ptrn.seq.stop()
            }
          }
          return args
        }
      
        fnc.values.filters.push( filter )
      }
    
      fnc.score = function( __v__, __d__ ) {
        return fnc.seq.bind( obj, __v__, __d__ )
      }
    
      Object.defineProperties( fnc, {
        values: { 
          configurable: true,
          get: function() { return fnc[ num ].values },
          set: function( val ) { return fnc[ num ].values = val },
        },
        durations: { 
          configurable: true,
          get: function() { return fnc[ num ].durations },
          set: function( val ) { return fnc[ num ].durations = val },
        }
      })
      
      // console.log( key, fnc.values, fnc.durations )
      return obj
    }
  },
  
  defineRampedProperty : function( obj, _key ) {
    var fnc = obj[ _key ], key = _key.slice(1), cancel
    
    fnc.ramp = function( from, to, length ) {
      if( arguments.length < 2 ) {
        console.err( 'ramp requires at least two arguments: target and time.' )
        return
      }
      
      if( typeof length === 'undefined' ) { // if only to and length arguments
        length = to
        to = from
        from = obj[ key ]()
      }
      
      if( cancel ) cancel()
      
      if( typeof from !== 'object' ) {
        obj[ key ] = Line( from, to, length )
      }else{
        from.retrigger( to, Gibber.Clock.time( length ) )
      }
      
      cancel = future( function() {
        obj[ key ] = to
      }, length )
      
      return obj
    }
  },
  
  createProxyMethods : function( obj, methods, priority ) {
    for( var i = 0; i < methods.length; i++ ) Gibber.defineSequencedProperty( obj, methods[ i ], priority ) 
  },
  
  defineProperty : function( obj, propertyName, shouldSeq, shouldRamp, mappingsDictionary, shouldUseMappings, priority, useOldGetter ) {
    var originalValue = typeof obj[ propertyName ] === 'object' ? obj[ propertyName ].valueOf() : obj[ propertyName ],
        Name = propertyName.charAt( 0 ).toUpperCase() + propertyName.slice( 1 ),
        property = function( v ) {
          var returnValue = property
          
          if( typeof v !== 'undefined' ) { 
            //obj[ propertyName ] = v
            //property.value = v
            if( property.oldSetter ) {
              property.oldSetter.call( obj, v )
            }else{
              obj[ propertyName ] = v
            }  
            
            returnValue = obj
          }
          
          return returnValue
        }

    // TODO: get rid of this line
    mappingsDictionary = shouldUseMappings ? mappingsDictionary || obj.mappingProperties[ propertyName ] : null
    
    $.extend( property, mappingsDictionary )
    
    $.extend( property, {
      'propertyName': propertyName, // can't redfine 'name' on a function, unless we eval or something...
      'Name':   Name,  
      value:    originalValue,
      type:     'property',
      object:   obj,
      targets:  [],
      valueOf:  function() { return property.value },
      toString: function() { 
        var output = ""
        if( typeof property.value === 'object' ) {
          output = property.value.toString()
        }else{
          output = property.value
        }
        return output
      },
      oldSetter: obj.__lookupSetter__( propertyName ),
      oldGetter: obj.__lookupGetter__( propertyName ),      
      oldMappingObjectGetter: obj.__lookupGetter__( Name ),
      oldMappingObjectSetter: obj.__lookupSetter__( Name )
    })
    
    Object.defineProperty( obj, propertyName, {
      configurable:true,
      get: function(){ 
        // var returnValue = property
        // if( useOldGetter ) {
        //   console.log( property.oldGetter )
        //   returnValue = property.oldGetter()
        // }
        // else if( property.oldMappingObjectGetter ) {
        //   return property.oldMappingObjectGetter()
        // }
        // return returnValue || property
        return property
      },
      set: function( v ){
        if( (typeof v === 'function' || typeof v === 'object' && v.type === 'mapping') && ( v.type === 'property' || v.type === 'mapping' ) ) {
          Gibber.createMappingObject( property, v )
        }else{
          if( shouldUseMappings && obj[ property.Name ] ) {
            if( typeof obj[ property.Name ].mapping !== 'undefined' ) { 
              if( obj[ property.Name ].mapping.remove ) obj[ property.Name ].mapping.remove( true )
            }
          }
          
          var newValue = v
        
          if( property.oldSetter ) {
            var setterResult = property.oldSetter.call( obj, v )
            if( typeof setterResult !== 'undefined' ) { newValue = setterResult }
          }
          
          property.value = newValue
        }
        
        return obj
      }
    })
    
    if( shouldSeq  ) Gibber.defineSequencedProperty( obj, propertyName, priority )
    if( shouldRamp ) Gibber.defineRampedProperty( obj, propertyName )
    
    // capital letter mapping sugar
    if( shouldUseMappings ) {
      Object.defineProperty( obj, property.Name, {
        configurable: true,
        get : function()  {
          if( typeof property.oldMappingObjectGetter === 'function' ) property.oldMappingObjectGetter()
          return property
        },
        set : function( v ) {
          obj[ property.Name ] = v
          if( typeof mapping.oldMappingObjectSetter === 'function' ) mapping.oldMappingObjectSetter( v )
        }
      })
    }
  },
                                 //obj, propertyName, shouldSeq, shouldRamp, mappingsDictionary, shouldUseMappings, priority, useOldGetter
  createProxyProperty: function( obj, _key, shouldSeq, shouldRamp, dict, _useMappings, priority ) {
    _useMappings = _useMappings === false ? false : true
    
    Gibber.defineProperty( obj, _key, shouldSeq, shouldRamp, dict, _useMappings, priority )
  },
  
  // obj, _key, shouldSeq, shouldRamp, dict, _useMappings, priority
  createProxyProperties : function( obj, mappingProperties, noSeq, noRamp ) {
    var shouldSeq = typeof noSeq === 'undefined' ? true : noSeq,
        shouldRamp = typeof noRamp === 'undefined' ? true : noRamp
    
    obj.gibber = true // keyword identifying gibber object, needed for notation parser    
    
    obj.mappingProperties = mappingProperties
    obj.mappingObjects = []
        
    for( var key in mappingProperties ) {
      if( ! mappingProperties[ key ].doNotProxy ) {
        Gibber.createProxyProperty( obj, key, shouldSeq, shouldRamp, mappingProperties[ key ] )
      }
    }
  },  
}

Gibber.Utilities = require( './utilities' )( Gibber )
// Gibber.Audio     = require( 'gibber.audio.lib/scripts/gibber/audio' )( Gibber )
// Gibber.Graphics  = require( 'gibber.graphics.lib/scripts/gibber/graphics/graphics' )( Gibber )
// Gibber.Interface = require( 'gibber.interface.lib/scripts/gibber/interface/interface' )( Gibber )
Gibber.mappings  = require( './mappings' )( Gibber )
Gibber.Euclid = require( './euclidean' )( Gibber )
// TODO: Make Score work without requiring audio
// Gibber.Score     = require( './score' )//( Gibber ) // only initialize once Gibber.Audio.Core is loaded, otherwise problems

module.exports = Gibber

})()