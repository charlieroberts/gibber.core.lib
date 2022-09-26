module.exports = function( Gibber ) {

  const Seq = function( props ) { 
    const pattern   = props.pattern
    const target    = props.target
    const key       = props.key
    const number    = props.number
    const delay     = props.delay
    const priority  = props.priority || 0
    let   rate      = props.rate || 1
    let   density   = props.density || 1
    let   autotrig  = false


    const render    = target.type !== undefined ? target.type.toLowerCase() : 'audio'
    //const Gibber.Audio.Gibberish = Gibber.Gibber.Audio.Gibberish !== undefined ? Gibber.Gibber.Audio.Gibberish : null

    const clear = render === 'audio'
      ? function() {
          this.stop()
          
          if( Gibber.Audio.Gibberish.mode === 'worklet' ) {
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
          
          const idx = Seq.sequencers.indexOf( seq )
          const __seq = Seq.sequencers.splice( idx, 1 )[0]
          if( __seq !== undefined ) {
            __seq.stop()
          }
      }

    const filters = [
      // report back triggered tokens for annotations
      function( val, tidal, uid ) {
        if( Gibberish.mode === 'processor' ) {
          Gibberish.processor.messages.push( tidal.id, 'update.uid', uid )   
          Gibberish.processor.messages.push( tidal.id, 'update.value', val )   
        }
        return val
      } 
    ]

    if( key === 'note' || key === 'chord' || key === 'trigger' ) {
      filters.push( ( args,tidal ) => {
        if( tidal.target.autotrig !== undefined ) {
          for( let s of tidal.target.autotrig ) {
            s.fire()
          }
        }
        return args
      })
    }

    let p
    try {
      p = Gibber.Audio.Gibberish.Tidal.Pattern( pattern ) 
    } catch(e) {
      Gibber.publish( 'error', `Your Tidal pattern ${pattern} used invalid syntax.` )
      return null
    }

    if( key !== 'degree' ) {
      const tokens = [...pattern.matchAll(/[a-zA-Z]+/g)].map( v=>v[0] )
      let tokenNotFound = false
      tokens.forEach( t => {
        if( target[ t ] === undefined ) {
          //console.error(
          //  `%c\nYour Tidal pattern is using a token (${t}) that can't be found on the targeted instrument.`, 
          //  `color:white;background:#900` 
          //  ) 
          
          Gibber.publish( 'error', `\nYour Tidal pattern is using a token (${t}) that can't be found on the targeted instrument.\n` )
          tokenNotFound = true
        }
      })

      if( tokenNotFound === true ) return null
    }

    const seq = Gibber.Audio.Gibberish.Tidal({ pattern, target, key, priority, filters, mainthreadonly:props.mainthreadonly })
    seq.clear = clear
    seq.uid = Gibber.Audio.Gibberish.Tidal.getUID()
    
    //Gibber.Audio.Gibberish.proxyEnabled = false
    //Audio.Ugen.createProperty( seq, 'density', timings, [], Audio )
    //Gibber.Audio.Gibberish.proxyEnabled = true

    Gibber.addSequencing( seq, 'rotate', 1 )

    Seq.sequencers.push( seq )

    Gibber.subscribe( 'clear', ()=> seq.clear() )

    // if x.y.tidal() etc. 
    // standalone === false is most common use case
    if( props.standalone === false ) {
      let prevSeq = target[ '__' + key ].tidals[ number ] 
      if( prevSeq !== undefined ) {
        if( target.__sequencers !== undefined ) {
          const idx = target.__sequencers.indexOf( prevSeq )
          target.__sequencers.splice( idx, 1 )
        }
        // XXX stop() destroys an extra sequencer for some reason????
        prevSeq.stop()
        prevSeq.clear()
        //removeSeq( obj, prevSeq )
      }

      seq.start( Gibber.Audio.Clock.time( delay ) )

      target[ '__' + key ].tidals[ number ] = target[ '__' + key ][ number ] = seq
    }

    Gibber.publish( 'new tidal', seq )
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

  let val = 1 
  Object.defineProperty( Seq, 'cps', {
    get() { return val },
    set(v) {
      val = v
      Gibber.Audio.Gibberish.Tidal.cps = v
    }
  })

  return Seq

}
