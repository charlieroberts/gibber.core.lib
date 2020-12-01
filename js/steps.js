module.exports = function( Gibber ) {
 
const Steps = {
  type:'Steps',
  create( _steps, target ) {
    const stepseq = Object.create( Steps )
    
    stepseq.seqs = {}

    for( let _key in _steps ) {
      let values = _steps[ _key ]
      const parsedKey = parseInt( _key )
      const key = isNaN( parsedKey ) ? _key : parsedKey

      let usesStringValues = false
      if( values.isPattern !== true ) {
        if( Array.isArray( values ) ) {
          values = Gibber.Pattern( ...values )
        }else if( typeof values === 'string' ) {
          values = values.split('')
          usesStringValues = true
        }else{
          values = Gibber.Pattern( values )
        }
      }

      const seq = Gibber.Seq({
        values: usesStringValues ? values : key,
        timings: usesStringValues ?  [ 1  / values.length ] : values,
        'key': target.__isEnsemble !== true ? 'note' : 'play', 
        target, 
        priority:0
      })

      if( usesStringValues ) {
        seq.values.addFilter( new Function( 'args', 'ptrn', 
         `let sym = args[ 0 ],
              velocity = parseInt( sym, 16 ) / 15

          if( isNaN( velocity ) ) {
            velocity = 0
          }

          // TODO: is there a better way to get access to beat, beatOffset and scheduler?
          if( velocity !== 0 ) {
            ptrn.seq.target.loudness = velocity
          }

          args[ 0 ] = sym === '.' ? -987654321 : ${typeof key === 'string' ? `'${key}'` : key }

          return args
        `) )
      }

      stepseq.seqs[ _key ] = seq
      //stepseq.seqs[ _key ].mode = usesStringValues ? seq.values : seq.timings

      stepseq[ _key ] = usesStringValues ? seq.values : seq.timings
    }

    stepseq.start()
    stepseq.addPatternMethods()

    return stepseq
  },
  
  /* two parts:
   * 1. The easy part, make methods that can be called from the main thread
   *    and run over every seq instance in the step sequencer
   * 2. The hard part, make an object that lives in the audio thread
   *    and can be sequenced. It needs references to all sequencers in the 
   *    step sequencer.
   */
  addPatternMethods() {
    // XXX shouldn't use audio id by default... sigh
    const id = Gibber.Audio.Gibberish.utilities.getUID()

    // store ids of all controlled sequencers
    const seqIds = []
    for( let key in this.seqs ) {
      seqIds.push( this.seqs[ key ].id )
    }

    // this object will be transferred to audio thread
    const obj = { id, seqIds }

    groupMethodNames.forEach( name => {
      // EASY PART 
      this[ name ] = function( ...args ) { 
        for( let key in this.seqs ) { 
          this.seqs[ key ].values[ name ].apply( this, args ) 
        } 
      }

      this[ name ].sequencers = []
      this[ name ].seq = ( values, timings, number = 0, delay = 0 ) => {
        const s = Gibber.Seq({ 
          values, 
          timings, 
          target:this.__wrapped,
          key:name,
          priority:1,
        }).start()
        
        this[ name ].sequencers.push( s )

        // needed for annotations
        this[ name ][ number ] = s

        return this 
      } 

      // store function body to create function in audio thread representation of steps
      // needs to be one line for stringify / parsing
      // XXX ugh arguments? is there ever more than one argument?
      obj[ name ] = `for( let seq of this.seqs ) { seq.values.${name}.apply( this, arguments ); seq.timings.${name}.apply( this, arguments )}`
    })

    // HARD PART
    // code to be evaluated in audio thread
    // 1. create a new object, steps, bassed on stringifying obj
    // 2. add all of the transform methods
    // 3. store all controlled sequencers in steps.seqs after getting references
    //    from Gibberish.ugens 
    const code = `const steps = JSON.parse( \`${JSON.stringify(obj)}\` )
      const methods = ${JSON.stringify( groupMethodNames ) }
      steps.seqs = steps.seqIds.map( id => Gibberish.ugens.get( id ) )
      for( let method of methods ) {
        steps[ method ] = new Function( steps[ method ] ) 
      }
      Gibberish.ugens.set( steps.id, steps )`
 
    Gibber.Audio.Gibberish.worklet.port.postMessage({
      address:'eval',
      code
    }) 

    this.__wrapped = obj
  },

  start() {
    for( let key in this.seqs ) { 
      this.seqs[ key ].start()
    }
  },

  stop() {
    for( let key in this.seqs ) { 
      this.seqs[ key ].stop()
    }
  },

  clear() { 
    this.stop() 

    for( let key in this.seqs ) {
      this.seqs[ key ].timings.clear()
    }
  }

}

const groupMethodNames = [ 
  'rotate', 'reverse', 'transpose', 'range',
  'shuffle', 'scale', 'repeat', 'store', 
  'reset','flip', 'invert', 'set', 'double'
]

return Steps.create

}
