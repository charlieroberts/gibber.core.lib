module.exports = function( Gibber ) {
  const addValuesFilters = (seq,key,target) => {
    const values = seq.values

    // XXX support [1/8,1/4,1/16].rnd( 1/16, 2 ) syntax
    // to always play 1/16th notes twice
    if( values.randomFlag ) {
      values.addFilter( ( args,ptrn ) => {
        const range = ptrn.values.length - 1
        const idx = Math.round( Math.random() * range )
        return [ ptrn.values[ idx ], 1, idx ] 
      })
      for( let i = 0; i < values.randomArgs.length; i+=2 ) {
        values.repeat( values.randomArgs[ i ], values.randomArgs[ i + 1 ] )
      }
    }

    // trigger autotrig patterns
    if( key === 'note' || key === 'chord' || key === 'trigger' || key === 'notef' || key === 'pickplay' ) {
      values.addFilter( ( args,ptrn ) => {
        if( ptrn.seq.target.autotrig !== undefined ) {
          for( let s of ptrn.seq.target.autotrig ) {
            s.fire()
          }
        }
        return args
      })
    } 
  }

  const addTimingFilters = function( seq,key,renderMode ) {
    const __timings = seq.timings
    if( __timings.randomFlag ) {
      __timings.addFilter( ( args,ptrn ) => {
        const range = ptrn.values.length - 1
        const idx = Math.round( Math.random() * range )
        return [ ptrn.values[ idx ], 1, idx ] 
      })
      for( let i = 0; i < __timings.randomArgs.length; i+=2 ) {
        __timings.repeat( __timings.randomArgs[ i ], __timings.randomArgs[ i + 1 ] )
      }
    }

    const filter = renderMode === 'Audio' 
      ? (args,ptrn) => {
        if( typeof args[0] === 'number' ) {
          args[0] = Gibberish.Clock.time( args[0] )
        }
        return args
      }
      : (args,ptrn) => {
        if( typeof args[0] === 'number' ) {
          args[0] = Gibber.Clock.time( args[0] )
        }
        return args
      }  

    seq.timings.addFilter( (args,ptrn)=>{
      if( args[0] === 0 ) {
        ptrn.seq.stop()
        console.warn( 'sequencer attempting to fire with a time of zero; this will result in an infinite loop, so the sequencer has been stopped.' )
      }
      return args
    })
    seq.timings.addFilter( filter ) 
  }

  const Seq = function( props ) { 
    let   __values  = props.values
    const __timings = props.timings
    const delay     = props.delay
    const target    = props.target
    const key       = props.key
    const priority  = props.priority
    let   rate      = props.rate || 1
    let   density   = props.density || 1
    let   autotrig  = false
    const render    = props.render || 'Audio'

    const Gibberish = Gibber.Audio.Gibberish !== undefined ? Gibber.Audio.Gibberish : null

    if( __values.type === 'gen' ) {
      __values = __values.render()
    }

    if( Array.isArray( __values ) && __values.length <= 0 ) throw Error('arrays passed to sequences must have at least one value inside of them')
    // convert to pattern if needed and render
    const values = Array.isArray( __values ) 
      ? Gibber.Pattern( ...__values ).render()
      : typeof __values === 'function' && __values.isPattern 
        ? __values.render()
        : __values.requiresRender 
          ? __values
          : Gibber.Pattern( __values ).render()

    // if an array of values is passed, let users call pattern method on that array, for example:
    // a.note.seq( b=[0,1,2,3], 1/4 )
    // b.transpose.seq( 1,1 )
    // also set random flag if needed
    if( Array.isArray( __values ) ) {
      Object.assign( __values, values )
      __values.addFilter = values.addFilter.bind( values )
      __values.removeFilter = values.removeFilter.bind( values )
      __values.inspect = values.inspect.bind( values )
      if( __values.randomFlag !== undefined ) values.randomFlag = __values.randomFlag
      if( __values.randomArgs !== undefined ) values.randomArgs = __values.randomArgs
    } else if( typeof __values === 'object' && __values.type==='gen' ) {
      props.values.addFilter = values.addFilter.bind( values )
      props.values.removeFilter = values.removeFilter.bind( values )
      props.values.inspect = values.inspect.bind( values )
    }

    // process time values
    if( target !== undefined ) {
      if( Gibber[ render ].timeProps[ target.name ] !== undefined 
        && Gibber[ render ].timeProps[ target.name ].indexOf( key ) !== -1  ) {

        const filter = render === 'Audio' 
          ? (args,ptrn) => {
              args[0] = Gibberish.Clock.time( args[0] )
              return args
            }
          : (args,ptrn) => {
              args[0] = Gibber.Audio.Clock.time( args[0] )
              return args
            }

        values.addFilter( filter )
      }
    }
 
    const timings = Array.isArray( __timings ) 
      ? Gibber.Pattern( ...__timings ).render()
      : typeof __timings === 'function' && __timings.isPattern 
        ? __timings.render()
        : __timings === undefined || __timings === null 
          ? null
          : __timings.requiresRender
            ? __timings
            : Gibber.Pattern( __timings ).render()


    if( timings === null ) autotrig = true

    if( Array.isArray( __timings ) ) {
      Object.assign( __timings, timings )
      __timings.addFilter = timings.addFilter.bind( timings )
      if( __timings.randomFlag !== undefined ) timings.randomFlag = __timings.randomFlag
      if( __timings.randomArgs !== undefined ) timings.randomArgs = __timings.randomArgs
    }
    if( autotrig === false ) {
      timings.output = { time:'time', shouldExecute:0 }
      timings.density = 1

      // XXX delay annotations so that they occur after values annotations have occurred. There might
      // need to be more checks for this flag in the various annotation update files... right now
      // the check is only in createBorderCycle.js.
      timings.__delayAnnotations = true
    }

    // if an array is passed to the seq, enable users to call pattern methods on array
    //if( Array.isArray( __timings ) ) Object.assign( __timings, timings )

    const clear = render === 'Audio'
      ? function() {
          this.stop()
          
          if( this.values !== undefined && this.values.clear !== undefined  ) {
            this.values.clear()
          }
          if( this.timings !== undefined && this.timings !== null && this.timings.clear !== undefined ) this.timings.clear()

          
          if( Gibberish.mode === 'worklet' ) {
            const idx = Seq.sequencers.indexOf( seq )
            seq.stop()
            const __seq = Seq.sequencers.splice( idx, 1 )[0]
            if( __seq !== undefined ) {
              __seq.stop()
            }
          }
        }
      : function() {
          this.stop()
          
          if( this.values !== undefined && this.values.clear !== undefined  ) this.values.clear()
          if( this.timings !== undefined && this.timings !== null && this.timings.clear !== undefined ) this.timings.clear()

          const idx = Seq.sequencers.indexOf( seq )
          const __seq = Seq.sequencers.splice( idx, 1 )[0]
          if( __seq !== undefined ) {
            __seq.stop()
          }
        }

    values.__patternType = 'values'
    if( timings !== null ) timings.__patternType = 'timings'

    //const offsetRate = Gibberish.binops.Mul(rate, Gibber.Clock.AudioClock )

    // XXX need to fix so that we can use the clock rate as the base
    // XXX need to abstract this so that a graphics sequencer could also be called...
    const seq = Gibber.Audio.Gibberish.Sequencer({ values, timings, density, target, key, priority, rate:1/*Gibber.Clock.AudioClock*/, clear, autotrig, mainthreadonly:props.mainthreadonly })

    if( values.setSeq ) values.setSeq( seq )

    addValuesFilters( seq,key )

    if( autotrig === false ) {
      addTimingFilters( seq,key,render )
      if( timings.setSeq ) timings.setSeq( seq )
    }else{
      if( target !== undefined ) {
        if( target.autotrig === undefined ) {
          target.autotrig = []
          Gibber.Audio.Gibberish.worklet.port.postMessage({
            address:'property',
            name:'autotrig',
            value:[],
            object:target.id
          })

        }
        // object name key value
        if( Gibber.Audio.Gibberish.mode === 'worklet' ) {
          Gibber.Audio.Gibberish.worklet.port.postMessage({
            address:'addObjectToProperty',
            name:'autotrig',
            object:target.id,
            key:target.autotrig.length,
            value:seq.id
          })
          target.autotrig.push( seq )
        }
      }else{
        throw Error('you must define timings for any sequence without a target')
      }
    } 

    //Gibberish.proxyEnabled = false
    //Gibber.Ugen.createProperty( seq, 'density', timings, [], Gibber )
    //Gibberish.proxyEnabled = true

    Seq.sequencers.push( seq )

    // if x.y.seq() etc. 
    // standalone === false is most common use case
    if( props.standalone === false ) { 
      // required ternary because pattern methods don't have __ prefix 
      const targetProp = target[ '__' + key ] === undefined 
        ? target[ key ] 
        : target[ '__' + key ]
      
      const prevSeq = targetProp.sequencers[ props.number ] 
      if( prevSeq !== undefined ) { 
        prevSeq.clear();
      }


      // XXX you have to add a method that does all this shit on the worklet. crap.
      targetProp.sequencers[ props.number ] = seq
      targetProp[ props.number ] = seq 
      //target.__sequencers.push( seq )
      if( typeof delay !== 'function' ) { 
        seq.start( Gibber.Audio.Clock.time( delay ) )
      } else {
        delay.seqs.push( seq )
      }
    }

    Gibber.publish( 'new sequence', seq )

    return seq
  }

  Seq.sequencers = []
  Seq.clear = function() {
    Seq.sequencers.forEach( seq => seq.clear() )
    //for( let i = Seq.sequencers.length - 1; i >= 0; i-- ) {
    //  Seq.sequencers[ i ].clear()
    //}
    Seq.sequencers = []
  }
  Seq.DNR = -987654321

  return Seq

}
