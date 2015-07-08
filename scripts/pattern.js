module.exports = function( Gibber ) {

"use strict"

var $ = require( './dollar' )

var PatternProto = {
  concat : function( _pattern ) { this.values = this.values.concat( _pattern.values ) },  
  toString: function() { return this.values.toString() },
  valueOf: function() { return this.values },
  getLength: function() {
    var l
    if( this.start <= this.end ) {
      l = this.end - this.start + 1
    }else{
      l = this.values.length + this.end - this.start + 1
    }
    return l
  },
  runFilters : function( val, idx ) {
    var args = [ val, 1, idx ] // 1 is phaseModifier

    for( var i = 0; i < this.filters.length; i++ ) {
      args = this.filters[ i ]( args, this )
    }
    
    return args
  },
  _onchange : function() {},
}

var Pattern = function() {
  if( ! ( this instanceof Pattern ) ) {
    var args = Array.prototype.slice.call( arguments, 0 )
    return Gibber.construct( Pattern, args )
  }

  var fnc = function() {
    var len = fnc.getLength(),
        idx, val, args
    
    if( len === 1 ) { 
      idx = 0 
    }else{
      idx = fnc.phase >-1 ? Math.floor( fnc.start + (fnc.phase % len ) ) : Math.floor( fnc.end + (fnc.phase % len ) )
    }
    
    val = fnc.values[ Math.floor( idx % fnc.values.length ) ]
    args = fnc.runFilters( val, idx )
    
    fnc.phase += fnc.stepSize * args[ 1 ]
    val = args[ 0 ]
    
    if( typeof val === 'function' ) val = val()
    
    // if pattern has update function, set new value
    if( fnc.update ) fnc.update.value = val
    
    return val
  }
   
  $.extend( fnc, {
    start : 0,
    end   : 0,
    phase : 0,
    values : Array.prototype.slice.call( arguments, 0 ),
    //values : typeof arguments[0] !== 'string' || arguments.length > 1 ? Array.prototype.slice.call( arguments, 0 ) : arguments[0].split(''),    
    original : null,
    storage : [],
    stepSize : 1,
    integersOnly : false,
    filters : [],
    /*humanize: function() {
      
    },*/
    onchange : null,

    range : function() {
      if( Array.isArray( arguments[0] ) ) {
        fnc.start = arguments[0][0]
        fnc.end   = arguments[0][1]
      }else{
        fnc.start = arguments[0]
        fnc.end   = arguments[1]
      }
      
      return fnc;
    },
    
    set: function() {
      fnc.values.length = 0
      
      for( var i = 0; i < arguments[0].length; i++ ) {
        fnc.values.push( arguments[0][i] )
      }
      
      if( fnc.end > fnc.values.length - 1 ) { fnc.end = fnc.values.length - 1 }
    },
     
    reverse : function() { 
      //fnc.values.reverse(); 
      var array = fnc.values,
          left = null,
          right = null,
          length = array.length,
          temporary;
          
      for (left = 0, right = length - 1; left < right; left += 1, right -= 1) {
        temporary = array[left];
        array[left] = array[right];
        array[right] = temporary;
      }
      
      fnc._onchange() 
      
      return fnc;
    },
    
    repeat: function() {
      var counts = {}
    
      for( var i = 0; i < arguments.length; i +=2 ) {
        counts[ arguments[ i ] ] = {
          phase: 0,
          target: arguments[ i + 1 ]
        }
      }
      
      var repeating = false, repeatValue = null, repeatIndex = null
      var filter = function( args ) {
        var value = args[ 0 ], phaseModifier = args[ 1 ], output = args
        
        //console.log( args, counts )
        if( repeating === false && counts[ value ] ) {
          repeating = true
          repeatValue = value
          repeatIndex = args[2]
        }
        
        if( repeating === true ) {
          if( counts[ repeatValue ].phase !== counts[ repeatValue ].target ) {
            output[ 0 ] = repeatValue            
            output[ 1 ] = 0
            output[ 2 ] = repeatIndex
            //[ val, 1, idx ]
            counts[ repeatValue ].phase++
          }else{
            counts[ repeatValue ].phase = 0
            output[ 1 ] = 1
            if( value !== repeatValue ) { 
              repeating = false
            }else{
              counts[ repeatValue ].phase++
            }
          }
        }
      
        return output
      }
    
      fnc.filters.push( filter )
    
      return fnc
    },
  
    reset : function() { fnc.values = fnc.original.slice( 0 ); fnc._onchange(); return fnc; },
    store : function() { fnc.storage[ fnc.storage.length ] = fnc.values.slice( 0 ); return fnc; },
    transpose : function( amt ) { 
      for( var i = 0; i < fnc.values.length; i++ ) { 
        var val = fnc.values[ i ]
        
        if( $.isArray( val ) ) {
          for( var j = 0; j < val.length; j++ ) {
            val[ j ] = fnc.integersOnly ? Math.round( val[ j ] + amt ) : val[ j ] + amt
          }
        }else{
          fnc.values[ i ] = fnc.integersOnly ? Math.round( fnc.values[ i ] + amt ) : fnc.values[ i ] + amt
        }
      }
      
      fnc._onchange()
      
      return fnc
    },
    shuffle : function() { 
      Gibber.Utilities.shuffle( fnc.values )
      fnc._onchange()
      
      return fnc
    },
    scale : function( amt ) { 
      for( var i = 0; i < fnc.values.length; i++ ) {
        var val = fnc.values[ i ]
        if( $.isArray( val ) ) {
          for( var j = 0; j < val.length; j++ ) {
            val[ j ] = fnc.integersOnly ? Math.round( val[ j ] * amt ) : val[ j ] * amt
          }
        }else{
          fnc.values[ i ] = fnc.integersOnly ? Math.round( fnc.values[ i ] * amt ) : fnc.values[ i ] * amt
        }
      }
      fnc._onchange()
      
      return fnc
    },

    flip : function() {
      var start = [],
          ordered = null
    
      ordered = fnc.values.filter( function(elem) {
      	var shouldPush = start.indexOf( elem ) === -1
        if( shouldPush ) start.push( elem )
        return shouldPush
      })
    
      ordered = ordered.sort( function( a,b ){ return a - b } )
    
      for( var i = 0; i < fnc.values.length; i++ ) {
        var pos = ordered.indexOf( fnc.values[ i ] )
        fnc.values[ i ] = ordered[ ordered.length - pos - 1 ]
      }
      
      fnc._onchange()
    
  		return fnc
    },
    
    invert: function() {
      var prime0 = fnc.values[ 0 ]
      
      for( var i = 1; i < fnc.values.length; i++ ) {
        var inverse = prime0 + (prime0 - fnc.values[ i ])
        fnc.values[ i ] = inverse
      }
      
      fnc._onchange()
      
  		return fnc
    },
  
    switch : function( to ) {
      if( fnc.storage[ to ] ) {
        fnc.values = fnc.storage[ to ].slice( 0 )
      }
      
      fnc._onchange()
      
      return fnc
    },
  
    rotate : function( amt ) {
      if( amt > 0 ) {
        while( amt > 0 ) {
          var end = fnc.values.pop()
          fnc.values.unshift( end )
          amt--
        }
      }else if( amt < 0 ) {
        while( amt < 0 ) {
          var begin = fnc.values.shift()
          fnc.values.push( begin )
          amt++
        }
      }
      
      fnc._onchange()
      
      return fnc
    }
  })
  
  fnc.retrograde = fnc.reverse.bind( fnc )
  
  fnc.end = fnc.values.length - 1
  
  fnc.original = fnc.values.slice( 0 )
  fnc.storage[ 0 ] = fnc.original.slice( 0 )
  
  fnc.integersOnly = fnc.values.every( function( n ) { return n === +n && n === (n|0); })
  
  Gibber.createProxyMethods( fnc, [
    'rotate','switch','invert','reset', 'flip',
    'transpose','reverse','shuffle','scale',
    'store', 'range', 'set'
  ], true )
  
  Gibber.createProxyProperties( fnc, { 'stepSize':0, 'start':0, 'end':0 })
  
  fnc.__proto__ = this.__proto__ 
  
  return fnc
}

Pattern.prototype = PatternProto

return Pattern

}