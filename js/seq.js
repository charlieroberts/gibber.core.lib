module.exports = function( Gibber ) {

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

    if( __values.type === 'gen' ) __values = __values.render()

    const values = Array.isArray( __values ) 
      ? Gibber.Pattern( ...__values ).render()
      : Gibber.Pattern( __values    ).render()

    if( __values.randomFlag ) {
      values.addFilter( ( args,ptrn ) => {
        const range = ptrn.values.length - 1
        const idx = Math.round( Math.random() * range )
        return [ ptrn.values[ idx ], 1, idx ] 
      })
      //for( let i = 0; i < this.values.randomArgs.length; i+=2 ) {
      //  valuesPattern.repeat( this.values.randomArgs[ i ], this.values.randomArgs[ i + 1 ] )
      //}
    }

    // trigger autotrig patterns
    if( key === 'note' || key === 'chord' || key === 'trigger' ) {
      values.addFilter( ( args,ptrn ) => {
        if( ptrn.seq.target.autotrig !== undefined ) {
          for( let s of ptrn.seq.target.autotrig ) {
            s.fire()
          }
        }
        return args
      })
    } 

    // process time values
    if( Gibber[ render ].timeProps[ target.name ] !== undefined && Gibber[ render ].timeProps[ target.name ].indexOf( key ) !== -1  ) {
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

    let timings
    if( Array.isArray( __timings ) ) {
      timings  = Gibber.Pattern( ...__timings )
    }else if( typeof __timings === 'function' && __timings.isPattern === true ) {
      timings = __timings
    }else if( __timings !== undefined && __timings !== null ) {
      timings = Gibber.Pattern( __timings )
    }else{
      timings = null
      autotrig = true
    }

    if( timings !== null ) timings = timings.render()

    if( autotrig === false ) {
      if( __timings.randomFlag ) {
        timings.addFilter( ( args,ptrn ) => {
          const range = ptrn.values.length - 1
          const idx = Math.round( Math.random() * range )
          return [ ptrn.values[ idx ], 1, idx ] 
        })
        //for( let i = 0; i < this.values.randomArgs.length; i+=2 ) {
        //  valuesPattern.repeat( this.values.randomArgs[ i ], this.values.randomArgs[ i + 1 ] )
        //}
      }
      timings.output = { time:'time', shouldExecute:0 }
      timings.density = 1
      const filter = render === 'Audio' 
        ? (args,ptrn) => {
          if( typeof args[0] === 'number' )
            args[0] = Gibberish.Clock.time( args[0] )

          return args
        }
        : (args,ptrn) => {
          if( typeof args[0] === 'number' )
            args[0] = Gibber.Clock.time( args[0] )

          return args
        }  

      timings.addFilter( filter ) 

      // XXX delay annotations so that they occur after values annotations have occurred. There might
      // need to be more checks for this flag in the various annotation update files... right now
      // the check is only in createBorderCycle.js.
      timings.__delayAnnotations = true
    }

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
    const seq = Gibber.Audio.Gibberish.Sequencer2({ values, timings, density, target, key, priority, rate:1/*Gibber.Clock.AudioClock*/, clear, autotrig, mainthreadonly:props.mainthreadonly })

    values.setSeq( seq )

    if( autotrig === false ) {
      timings.setSeq( seq )
    }else{
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
    } 

    //Gibberish.proxyEnabled = false
    //Gibber.Ugen.createProperty( seq, 'density', timings, [], Gibber )
    //Gibberish.proxyEnabled = true

    Seq.sequencers.push( seq )

    // if x.y.seq() etc. 
    // standalone === false is most common use case
    if( props.standalone === false ) { 
      // required ternary because pattern methohds don't have __ prefix 
      const targetProp = target[ '__' + key ] === undefined 
        ? target[ key ] 
        : target[ '__' + key ]
      
      const prevSeq = targetProp.sequencers[ props.number ] 
      if( prevSeq !== undefined ) { 
        prevSeq.clear();
      }

      // XXX you have to add a method that does all this shit on the worklet. crap.
      targetProp.sequencers[ props.number ] = targetProp[ props.number ] = seq
      seq.start( Gibber.Audio.Clock.time( delay ) )
    }

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
