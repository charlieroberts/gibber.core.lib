const patternWrapper = function( Gibber ) {
  "use strict"

  // hack to pass Gibberish to pattern generator from within worklet processor
  let Gibberish
  if( Gibber.Gibberish === undefined ) {
    Gibberish = Gibber.Audio !== undefined ? Gibber.Audio.Gibberish : Gibber 
  }else{
    Gibberish = Gibber.Gibberish
  }

  let PatternProto = Object.create( function(){} )

  // this prototype is somewhat limited, as we want to be able to add
  // .seq() methods to everything. This means that every pattern needs its own
  // copy of each method. One alternative would be to use a more comprehensive
  // prototype and then place proxies on each method of each pattern that access
  // object-specific sequencers... but just making copies of all functions is certainly
  // simpler.
  Object.assign( PatternProto, {
    type:'pattern',
    DNR: -987654321,
    concat( _pattern ) { this.values = this.values.concat( _pattern.values ) },  
    //toString() { return this.values.toString() },
    //valueOf() { return this.values },

    __message(  key, args ) {
      if( this.category === 'audio' ) {
        if( Gibberish.mode === 'processor' )
          Gibberish.processor.messages.push( this.id, key, args )
      } 
    },

    getLength() {
      let l
      if( this.start <= this.end ) {
        l = this.end - this.start + 1
      }else{
        l = this.values.length + this.end - this.start + 1
      }
      return l
    },

    runFilters( val, idx ) {
      let args = [ val, 1, idx ] // 1 is phaseModifier

      for( let filter of this.filters ) {
        const __args = args
        try {
          args = filter( args, this ) 
        } catch( e ) {
          console.error( e )
          console.log( 'filter problem?' )
          console.log( `removing bad filter from pattern: ${filter.toString()}` ) 
          const idx = this.filters.indexOf( filter )
          this.filters.splice( idx, 1 )
          args = __args
        }
      }

      // XXX why is this one off from the worklet-side pattern id?
      this.__message( 'update.value', args.override === undefined ? args[0] : args.override ) 
      this.__message( 'update.currentIndex', args[2] ) 
      if( this.isGen === true ) {
        this.__message( 'waveformPoint', args.override === undefined ? args[0] : args.override ) 
      }

      return args
    },

    checkForUpdateFunction( name, ...args ) {
      if( this.__delayAnnotations === true ) {
        setTimeout( ()=> {
          if( this.listeners[ name ] ) {
            this.listeners[ name ].apply( this, args )
          }else if( Pattern.listeners[ name ] ) {
            Pattern.listeners[ name ].apply( this, args )
          }
        }, 5 )
      }else{
        if( this.listeners[ name ] ) {
          this.listeners[ name ].apply( this, args )
        }else if( Pattern.listeners[ name ] ) {
          Pattern.listeners[ name ].apply( this, args )
        }
      }
    },

    // used when _onchange has not been assigned to individual patterns
    _onchange() {},

    // XXX it would be nice if filters used a similar style to fx chains...
    // pattern.filters.add( ) etc.
    addFilter( filter, name=null ) {
      if( name !== null ) {
        filter.__name = name
        const idx = this.filters.findIndex( f => f.__name === name )
        this.filters.splice( idx, 1 )  
      }
      this.filters.push( filter )
      return this
    },

    removeFilter( idx=null ) {
      if( idx !== null ) {
        this.filters.splice( idx, 1 )  
      }else{
        this.filters.length = 0
      }

      return this
    },

    inspect() {
      if( Gibberish.mode === 'processor' ) 
        console.table({ values:this.values.toString(), 'number of filters':this.filters.length, phase:this.phase })
    },

    render( cat='Audio' ) {
      this.category = cat
      if( typeof Gibber[ cat ] === 'object' && typeof Gibber[ cat ].patternRender === 'function' ) {
        Gibber[ cat ].patternRender( this )
      }
      if( typeof this.onrender === 'function' ) {
        this.onrender()
      }
    },

    copy() {
      const p = Pattern( ...this.values )
      //this.filters.forEach( f => p.addFilter( f ) )
      p.start = this.start
      p.end   = this.end
      p.phase = this.phase

      return p
    },

    __methodNames:  [
      'rotate','switch','invert','flip',
      'transpose','reverse','shuffle','scale',
      'store', 'range', 'set', 'freeze', 'thaw', 'double'
    ]

  })

  const Pattern = function( ...args ) {
    //console.log( 'args[0]:', args[0].isPattern, args[0] )
    //if( typeof args[0] === 'function' && args[0] !== null && args[0].isPattern === true ) {
    //  console.log( 'got pattern' )
    //  return args[0]
    //}

    const isFunction = args.length === 1 && typeof args[0] === 'function',
          isGen = typeof args[0] === 'object' && args[0].__isGen

    //if( isGen === true ) { 
    //  // must have a priority or it screws us codegen for analysis
    //  args[0].priority = 0
    //  Gibberish.analyzers.push( args[0] )
    //  Gibberish.dirty( Gibberish.analyzers )
    //}


    const fnc = function() {
      let len = fnc.getLength(),
          idx, val, args

      if( len === 1 ) { 
        idx = 0 
      }else{
        idx = fnc.phase > -1 ? Math.floor( fnc.start + (fnc.phase % len ) ) : Math.floor( fnc.end + (fnc.phase % len ) )
      }

      if( isFunction ) {
        val = fnc.values[ 0 ]()
        args = fnc.runFilters( val, idx )
        val = args[0]
      } else if( isGen === true ) {
        val = fnc.values[ 0 ].callback.out[0]

        args = fnc.runFilters( val, idx )
        val = args[0]
      }else{
        val = fnc.values[ Math.floor( idx % fnc.values.length ) ]
        args = fnc.runFilters( val, idx )
      
        fnc.phase += fnc.stepSize * args[ 1 ]


        val = args[ 0 ]
      }
      // check to see if value is a function, and if so evaluate it
      //if( typeof val === 'function' ) {
        //val = val()
      //}
      /*else if ( Array.isArray( val ) ) {
        // if val is an Array, loop through array and evaluate any functions found there. TODO: IS THIS SMART?

        for( let i = 0; i < val.length; i++ ){
          if( typeof val[ i ] === 'function' ) {
            val[ i ] = val[ i ]()
          }
        }
      }
      */

      //XXX is this needed? Adding it interferes with Steps
      //if( val === fnc.DNR ) val = null

      return val
    }



    let out 
    Object.assign( fnc, {
      category:'audio',
      start : 0,
      end   : 0,
      phase : 0,
      values : args, 
      isPattern: true,
      __frozen:false,
      // wrap annotation update in setTimeout( func, 0 )
      __delayAnnotations:false,
      //values : typeof arguments[0] !== 'string' || arguments.length > 1 ? Array.prototype.slice.call( arguments, 0 ) : arguments[0].split(''),    
      original : null,
      storage : [],
      stepSize : 1,
      integersOnly : false,
      filters : [],
      __listeners: [],
      onchange : null,
      isop:true,
      isGen,

      freeze( shouldFreezeTheory = true ) {
        fnc.__frozen = true
      },
      thaw() {
        fnc.__frozen = false
        Gibber.Theory.thaw()
      },

      setSeq( seq ) {
        this.seq = seq
      },

      range(...args) {
        if( this.__rendered !== undefined && this.__rendered !== this ) {
          this.__rendered.range( ...args )
          return this
        }

        if( !fnc.__frozen ) {
          let start, end
          
          if( Array.isArray( arguments[0] ) ) {
            start = arguments[0][0]
            end   = arguments[0][1]
          }else{
            start = arguments[0]
            end   = arguments[1]
          }
          
          if( start < end ) {
            fnc.start = start
            fnc.end = end
          }else{
            fnc.start = end
            fnc.end = start
          }

          this.checkForUpdateFunction( 'range', fnc )
        }

        return fnc
      },
      double(...args) {
        if( this.__rendered !== undefined && this.__rendered !== this ) {
          this.__rendered.double(...args)
          return this
        }
        if( !fnc.__frozen ) {

          fnc.values.push( ...fnc.values ) 
          
          fnc.end = fnc.values.length - 1
          
          // if( fnc.end > fnc.values.length - 1 ) {
          //   fnc.end = fnc.values.length - 1
          // }else if( fnc.end < )
          if( Gibberish.mode === 'processor' ) {
            fnc.__message( 'values', fnc.values ) 
            fnc.__message( '_onchange', true ) 
          }
          fnc._onchange()
        }
        
        return fnc
      },   

      set(...args) {
        if( this.__rendered !== undefined && this.__rendered !== this ) {
          this.__rendered.set(...args)
          return this
        }
        if( !fnc.__frozen ) {
          let args = Array.isArray( arguments[ 0 ] ) ? arguments[ 0 ] : arguments
          
          fnc.values.length = 0

          const tmp = [] 
          
          for( let i = 0; i < args.length; i++ ) {
            const val = args[i].isPattern === true ? args[ i ].original.slice(0) : args[ i ] 
            tmp.push( val )
          }
          fnc.values = tmp
          
          fnc.end = fnc.values.length - 1
          
          // if( fnc.end > fnc.values.length - 1 ) {
          //   fnc.end = fnc.values.length - 1
          // }else if( fnc.end < )
          if( Gibberish.mode === 'processor' ) {
            fnc.__message( 'values', fnc.values ) 
            fnc.__message( '_onchange', true ) 
          }
          fnc._onchange( 'set', fnc.values ) //args )
        }
        
        return fnc
      },
       
      reverse() {
        if( this.__rendered !== undefined && this.__rendered !== this ) {
          this.__rendered.reverse()
          return this
        }
        if( !fnc.__frozen ) {
          let array = fnc.values,
              left = null,
              right = null,
              length = array.length,
              temporary;
              
          for ( left = 0, right = length - 1; left < right; left += 1, right -= 1 ) {
            temporary = array[ left ]
            array[ left ] = array[ right ]
            array[ right ] = temporary;
          }
          
          if( Gibberish.mode === 'processor' ) {
            fnc.__message( 'values', array ) 
            fnc.__message( '_onchange', true ) 
          }

          fnc._onchange( 'reverse', null )
        }
        
        return fnc
      },
      // humanize: function( randomMin, randomMax ) {
   //      let lastAmt = 0
   //
   //      for( let i = 0; i < this.filters.length; i++ ) {
   //        if( this.filters[ i ].humanize ) {
   //          lastAmt = this.filters[ i ].lastAmt
   //          this.filters.splice( i, 1 )
   //          break;
   //        }
   //      }
   //
   //      let filter = function( args ) {
   //        console.log( filter.lastAmt, args[0])
   //        args[ 0 ] -= filter.lastAmt
   //        filter.lastAmt = Gibber.Clock.time( Gibber.Utilities.rndi( randomMin, randomMax ) )
   //
   //        console.log( "LA", filter.lastAmt )
   //        args[0] += filter.lastAmt
   //
   //        return args
   //      }
   //      filter.lastAmt = lastAmt
   //      filter.humanize = true
   //
   //      this.filters.push( filter )
   //
   //      return this
   //    },
      repeat() {
        let counts = {}
      
        for( let i = 0; i < arguments.length; i +=2 ) {
          counts[ arguments[ i ] ] = {
            phase: 0,
            target: arguments[ i + 1 ]
          }
        }
        
        let repeating = false, repeatValue = null, repeatIndex = null
        let filter = function( args ) {
          let value = args[ 0 ], phaseModifier = args[ 1 ], output = args
          
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
    
      reset() { 
        if( this.__rendered !== undefined && this.__rendered !== this ) {
          this.__rendered.reset()
          return this
        }
        if( !fnc.__frozen ) {
          // XXX replace with some type of standard deep copy
          if( Array.isArray( fnc.original[0] ) ) {
            const arr = []
            for( let i = 0; i < fnc.original.length; i++ ) {
              const chord = fnc.original[ i ]
              arr[ i ] = []
              for( let j = 0; j < chord.length; j++ ) {
                arr[ i ][ j ] = chord[ j ] 
              }
            }
            fnc.values = arr
          }else{
            fnc.values = fnc.original.slice(0)
          }
          //fnc.set( fnc.original.slice( 0 ) );
          if( Gibberish.mode === 'processor' ) {
            fnc.__message( 'values', fnc.values ) 
            fnc.__message( '_onchange', true ) 
          }  
          fnc._onchange( 'reset', null )
        }

        return fnc 
      },

      store( pos ) { fnc.storage[ pos || fnc.storage.length ] = fnc.values.slice( 0 ); return fnc; },

      transpose( amt ) { 
        if( this.__rendered !== undefined && this.__rendered !== this ) {
          this.__rendered.transpose( amt )
          return this
        }
        if( !fnc.__frozen ) {
          for( let i = 0; i < fnc.values.length; i++ ) { 
            let val = fnc.values[ i ]
            
            if( Array.isArray( val ) ) {
              for( let j = 0; j < val.length; j++ ) {
                if( typeof val[ j ] === 'number' ) {
                  val[ j ] = fnc.integersOnly ? Math.round( val[ j ] + amt ) : val[ j ] + amt
                }
              }
            }else{
              if( typeof val === 'number' ) {
                fnc.values[ i ] = fnc.integersOnly ? Math.round( fnc.values[ i ] + amt ) : fnc.values[ i ] + amt
              }
            }
          }
          if( Gibberish.mode === 'processor' ) {
            fnc.__message( 'values', fnc.values ) 
            fnc.__message( '_onchange', ['transpose', amt] ) 
          }      
          //fnc._onchange( 'transpose', amt )
        }
        
        return fnc
      },

      shuffle() { 
        if( this.__rendered !== undefined && this.__rendered !== this ) {
          this.__rendered.shuffle( )
          return this
        }
        if( !fnc.__frozen ) {
          Gibber.Utility.shuffle( fnc.values )
          fnc._onchange( 'shuffule', null )
        }
        
        return fnc
      },

      scale( amt ) { 
        if( this.__rendered !== undefined && this.__rendered !== this ) {
          this.__rendered.scale( amt )
          return this
        }
        if( !fnc.__frozen ) {
          fnc.values.map( (val, idx, array) => {
            if( Array.isArray( val ) ) {
              array[ idx ] = val.map( inside  => {
                if( typeof inside === 'number' ) {
                  return fnc.integersOnly ? Math.round( inside * amt ) : inside * amt
                } else {
                  return inside
                }
              })
            }else{
              if( typeof val === 'number' ) {
                array[ idx ] = fnc.integersOnly ? Math.round( val * amt ) : val * amt
              }
            }
          })
          if( Gibberish.mode === 'processor' ) {
            fnc.__message( 'values', fnc.values ) 
            fnc.__message( '_onchange', true ) 
          }
          fnc._onchange( 'scale', amt )
        }
        
        return fnc
      },

      flip() {
        if( this.__rendered !== undefined && this.__rendered !== this ) {
          this.__rendered.flip( )
          return this
        }
        if( !fnc.__frozen ) {
          let start = [],
              ordered = null
        
          ordered = fnc.values.filter( function(elem) {
            let shouldPush = start.indexOf( elem ) === -1
            if( shouldPush ) start.push( elem )
            return shouldPush
          })
        
          ordered = ordered.sort( function( a,b ){ return a - b } )
        
          for( let i = 0; i < fnc.values.length; i++ ) {
            let pos = ordered.indexOf( fnc.values[ i ] )
            fnc.values[ i ] = ordered[ ordered.length - pos - 1 ]
          }
          if( Gibberish.mode === 'processor' ) {
            fnc.__message( 'values', fnc.values ) 
            fnc.__message( '_onchange', true ) 
          }       
          fnc._onchange( 'flip', null )
        }
      
        return fnc
      },
      
      invert() {
        if( this.__rendered !== undefined && this.__rendered !== this ) {
          this.__rendered.invert( )
          return this
        }
        if( !fnc.__frozen ) {
          let prime0 = fnc.values[ 0 ]
          
          for( let i = 1; i < fnc.values.length; i++ ) {
            if( typeof fnc.values[ i ] === 'number' ) {
              let inverse = prime0 + (prime0 - fnc.values[ i ])
              fnc.values[ i ] = inverse
            }
          }
          
          if( Gibberish.mode === 'processor' ) {
            fnc.__message( 'values', fnc.values ) 
            fnc.__message( '_onchange', true ) 
          }

          fnc._onchange( 'invert', null )
        }
        
        return fnc
      },
    
      switch( to ) {
        if( this.__rendered !== undefined && this.__rendered !== this ) {
          this.__rendered.switch( to )
          return this
        }
        if( !fnc.__frozen ) {
          if( fnc.storage[ to ] ) {
            fnc.values = fnc.storage[ to ].slice( 0 )
          }
          
          fnc._onchange( 'switch', to )
        }
        
        return fnc
      },
    
      rotate( amt ) {
        if( this.__rendered !== undefined && this.__rendered !== this ) {
          this.__rendered.rotate( amt )
          return this
        }
        if( !fnc.__frozen ) {
          if( amt > 0 ) {
            while( amt > 0 ) {
              let end = fnc.values.pop()
              fnc.values.unshift( end )
              amt--
            }
          }else if( amt < 0 ) {
            while( amt < 0 ) {
              let begin = fnc.values.shift()
              fnc.values.push( begin )
              amt++
            }
          }

          if( Gibberish.mode === 'processor' ) {
            fnc.__message( 'values', fnc.values ) 
            fnc.__message( '_onchange', true ) 
          }

          fnc._onchange( 'rotate', amt )
        }
        
        return fnc
      },

      clear() {
        if( Gibberish.mode === 'worklet' ) {
          for( let key of PatternProto.__methodNames ) {
            for( let i = 0; i < out[ key ].sequencers.length; i++ ) {
              // this can most certainly be optimized, but I had real problems
              // getting this clearing to work, perhaps related to proxy behaviors?
              const __seq = Gibber.Seq.sequencers.find( s => s.id === out[ key ][ i ].id )
              if( __seq !== undefined ) {
                Gibber.Audio.Gibberish.worklet.port.postMessage({ address:'method', object:__seq.id, name:'stop', args:[] })
              
                __seq.stop()
                __seq.clear()

                const idx = Gibber.Seq.sequencers.indexOf( __seq )
                Gibber.Seq.sequencers.splice( idx, 1 )
                __seq.target[ __seq.key ][0].stop()
              }
            }
          } 
        }else{
          // genish-based patterns are connected as analyzers so that they
          // don't have to feed into a bus to get rendered. we must remove them
          // from the analysis array to finalize clearing.
          if( out.isGen === true ) {
            const idx = Gibberish.analyzers.indexOf( args[0] )
            if( idx !== -1 ) {
              Gibberish.analyzers.splice( idx, 1 )
              Gibberish.analyzers.dirty = true
            }
          }
        }
      }
    })
    
    if( Gibberish.mode === 'worklet' ) {
      fnc.id = Gibberish.utilities.getUID()

      if( isGen === true ) {
        fnc.waveformPoint = val => {
          // accounts for annoying edge case where wave pattern is
          // inlined to a call to .seq
          // XXX fix in parsing or somehow figure out how to only do this once
          if( fnc.widget !== undefined ) fnc.values[0].widget = fnc.widget
          if( fnc.values[0].widget !== undefined ) {

            // convert samples to beats
            if( fnc.__patternType === 'timings' ) {
              val = Gibber.Clock.stob( val )
            }
            fnc.values[0].widget.values[ fnc.values[0].widget.values.length - 1 ] = { value:val } 
          }
        }
      }
    }
    //fnc.filters.pattern = fnc
    // can I resotre this without making the object non-serializable?
    //fnc.retrograde = fnc.reverse.bind( fnc )
    
    fnc.end = fnc.values.length - 1
    
    /*
    fnc.filters.test = function() { console.log( 'test' ) }
    
    fnc.filters.add = function( f ) {
      this.filters.push( f )
    }.bind(fnc)
    fnc.filters.remove = function( idx ) {
      console.log( 'filter:', this )
      this.filters.splice( idx, 1 )
    }.bind( fnc )
    fnc.filters.inspect = function() {
      console.log( `there are currenly ${this.length} filters on this pattern` )
    }.bind(fnc)
    */

    if( Array.isArray( fnc.values[0] ) ) {
      const arr = []
      for( let i = 0; i < fnc.values.length; i++ ) {
        const chord = fnc.values[ i ]
        arr[ i ] = []
        for( let j = 0; j < chord.length; j++ ) {
          arr[ i ][ j ] = chord[ j ] 
        }
      }
      fnc.original = arr
    }else{
      fnc.original = fnc.values.slice(0)
    }

    fnc.storage[ 0 ] = fnc.original.slice( 0 )
    fnc.integersOnly = fnc.values.every( function( n ) { return n === +n && n === (n|0); })
    
    fnc.listeners = {}
    fnc.sequences = {}

    if( Gibberish.mode === 'worklet' ) {

      for( let key of PatternProto.__methodNames ) { 
        Gibber.addSequencing( fnc,key,2,undefined )
      }
      //for( let key of PatternProto.__methodNames ) { 
      //  fnc.sequencers[ key ] = Gibber.Core !== undefined 
      //    ? Gibber.Core.addSequencing( fnc, key, 2 ) 
      //    : Gibber.addSequencing( fnc,key,2 )
      //}
      fnc.sequences.reset = Gibber.addSequencing( fnc, 'reset', 1 )
    }
    
    // TODO: Gibber.createProxyProperties( fnc, { 'stepSize':0, 'start':0, 'end':0 })
    
    fnc.__proto__ = PatternProto 

    let pn = ''
    Object.defineProperty( fnc, 'patternName', {
      get() { return pn },
      set(__pn) {
        pn = __pn
      }
    })

    fnc.render = function( mode='audio' ) {
      if( mode === 'audio' ) {
        // 'isPattern' is a hack to force pattern initialization arguments to be submitted as
        // a list, instead of in a property dictionary. When 'isPattern' is true, gibberish
        // looks for an 'inputs' property and then passes its value (assumed to be an array)
        // using the spread operator to the constructor. 
        out = Gibberish.Proxy( 'pattern', { inputs:fnc.values, isPattern:true, filters:fnc.filters, id:fnc.id }, fnc ) 

        if( isGen === true ) { 
          // must have a priority or it screws up codegen for analysis
          args[0].priority = 0
          Gibberish.analyzers.push( args[0] )
          Gibberish.dirty( Gibberish.analyzers )
        }
      }

      if( args.filters ) {
        args.filters.forEach( f => out.addFilter( f ) )
      }else if( typeof args[0] === 'object' && args[0].filters ) {
        args[0].filters.forEach( f => out.addFilter( f ) )
      }

      Pattern.children.push( out )

      if( fnc.onrender ) fnc.onrender( out )

      fnc.__rendered = out

      return out
    }
    if( Gibberish.mode === 'processor' ) return fnc.render()

    return fnc 
  }

  Pattern.listeners = {}
  Pattern.children = []
  Pattern.__isFrozen = false
  Pattern.freeze = function( shouldFreezeTheory = true ) {
    Pattern.children.forEach( p => p.freeze() ) 
    if( shouldFreezeTheory === true ) {
      Gibber.Theory.freeze()
      Pattern.__isFrozen = true
    }
  }
  Pattern.thaw = ()=> {
    Pattern.children.forEach( p => p.thaw() )
    if( Pattern.__isFrozen === true ) {
      Gibber.Theory.thaw()
      Pattern.__isFrozen = false
    }
  }

  Pattern.export = function( obj ) {
    obj.freeze = Pattern.freeze
    obj.thaw   = Pattern.thaw
  }

  Pattern.listeners.range = function( fnc ) {
    //if( !Notation.isRunning ) return
    
    if( Gibberish.mode === 'processor' ) return

    // TODO: don't use Gibber.currentTrack, store the object in the pattern
    let rangeStart = fnc.markers[ fnc.start ].find(),
        rangeEnd   = fnc.markers[ fnc.end ].find()

    if( !fnc.range.init ) {
      fnc.range.init = true
      var ptrnStart = fnc.markers[ 0 ].find(),
          ptrnEnd = fnc.markers[ fnc.markers.length - 1 ].find()

      //fnc.column.editor.markText( ptrnStart.from, ptrnEnd.to, { className:'rangeOutside' })
      Gibber.Environment.editor.markText( ptrnStart.from, ptrnEnd.to, { className:'rangeOutside' })//className:'pattern-update-range-outside' })
      if( !Pattern.listeners.range.initialzied ) Pattern.listeners.range.init()
    }

    if( fnc.range.mark ) fnc.range.mark.clear()
    //fnc.range.mark = fnc.column.editor.markText( rangeStart.from, rangeEnd.to, { className:'rangeInside' })
    // TODO: Dont use GE.codemirror... how else do I get this? stored in pattern is created?
    fnc.range.mark = Gibber.Environment.editor.markText( rangeStart.from, rangeEnd.to, { className:'rangeInside' })
  }

  Pattern.listeners.range.init = function() {
    //$.injectCSS({ 
    //  '.rangeOutside': {
    //    'color':'#666 !important'
    //  },
    //  '.rangeInside': {
    //    'color':'rgba(102, 153, 221, 1) !important'
    //  }
    //})
    Pattern.listeners.range.initialized = true
  }

  //Pattern.prototype = PatternProto*/

  return Pattern

}

// helper function to pass the pattern constructor to the gibberish worklet processor.
patternWrapper.transfer = function( Audio, constructorString ) {
  if( Audio.Gibberish !== undefined && Audio.Gibberish.mode === 'worklet' ) {
    Audio.Gibberish.worklet.port.postMessage({
      address:'addConstructor',
      name:'Pattern',
      constructorString
    })
  }
}


module.exports = patternWrapper
