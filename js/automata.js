
// XXX Need to create automata in the AWP thread so that the evolve method can
// be easily sequenced. Or is there some way to simply add a method to the AWP instance?

module.exports = function( Gibber ) {

const Pattern = Gibber.Pattern

const numberToBinaryArray = num => {
  let str = Number( num ).toString( 2 )
  while( str.length < 8 ) {
    str = '0' + str
  }
  
  // need to use parseFloat and round due to fpe
  return str.split('').map( parseFloat ).map( Math.round )
}

const Automata = function( __rule=30, __axiom='00011000', evolutionSpeed=1, playbackSpeed ) {
  const axiom = typeof __axiom === 'string' ? __axiom : Number( __axiom ).toString( 2 ),
        rule  = numberToBinaryArray( __rule )

  let currentState = axiom.split('').map( parseFloat ).map( Math.round ),
      nextState    = currentState.slice( 0 ),
      pattern      = Gibber.Pattern( ...currentState )

  pattern.time = playbackSpeed === undefined ? 1 / currentState.length : playbackSpeed
  pattern.currentState = currentState
  pattern.nextState = nextState

  pattern.output = { time: pattern.time, shouldExecute: 0 }

  pattern.addFilter( ( args, ptrn ) => {
    let val = args[ 0 ]

    ptrn.output.time = Gibberish.Clock.time( ptrn.time )
    ptrn.output.shouldExecute = val

    args[ 0 ] = ptrn.output 

    return args
  })

  const width = currentState.length

  pattern.evolve = ()=> {
    this.currentState = this.nextState.slice( 0 )

    for( let i = 0; i < width; i++ ) {
      let sum = ''        
      sum += i > 0 ? this.currentState[ i - 1 ] : this.currentState[ this.currentState.length - 1 ]
      sum += this.currentState[ i ]
      sum += i < width - 1 ? this.currentState[ i + 1 ] : this.currentState[ 0 ]
      this.nextState[ i ] = rule[ 7 - Number( '0b'+sum ) ]
    }

    this.set( this.nextState )
  }

  pattern.evolve = pattern.evolve.bind( pattern )

  pattern.evolve.sequencers = []
  pattern.evolve.seq = function( values, timings, number=0, delay=0 ) {
    let prevSeq = pattern.evolve.sequencers[ number ] 
    //if( prevSeq !== undefined ) { 
      //removeSeq( obj, prevSeq )
    //}

    const s = Gibber.Seq({ values, timings, target:pattern, key:'evolve'})

    s.start( Gibber.Clock.time( delay ) )
    pattern.evolve.sequencers[ number ] = pattern.evolve[ number ] = s 
    //pattern.__sequencers.push( s )

    // return object for method chaining
    return pattern
  }
  //Gibber.addSequencingToMethod( pattern, 'evolve' )
  //Gibber.addSequencing( pattern, 'evolve', 1 )
  pattern.evolve.seq( 1, evolutionSpeed )
  //Gibber.Utility.future( ()=> pattern.evolve.seq( 1, evolutionSpeed ), evolutionSpeed )

  return pattern
}

return Automata 

}
