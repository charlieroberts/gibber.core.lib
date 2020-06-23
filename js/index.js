const Gibber = {
  initialized: false,
  exportTarget: null,
  plugins: [],
  // needed so audio plugin can transfer pattern function string to worklet
  Pattern: require( './pattern.js' ),

  /* 
   * const promises = Gibber.init([
   *   {
   *     plugin:Audio, // Audio is required, imported, or grabbed via <script>
   *     options: { workletPath:'../dist/gibberish_worklet.js' }
   *   },
   *   {
   *     plugin:Graphics,
   *     options:{ canvas:document.querySelector('canvas' ) }
   *   }
   * ])
  */

  init( plugins ) { 
    this.createPubSub()

    const promises = []

    // init each plugin and collect promises
    for( let plugin of plugins ) {
      promises.push( 
        plugin.init( plugin.options ) 
      )
    }

    const finishedInitPromise = Promise.all( promises, ()=> {
      // do something else here? export?
      Gibber.publish( 'init' )
    })
  
    return finishedInitPromise
  },

  export( obj, Gibber ) {
      //Utility.export( obj )
      //this.Gen.export( obj )
      //this.Pattern( Gibber ).export( obj )
      obj.Pattern = this.Pattern( Gibber )
      obj.Euclid  = require( './euclid.js'  )( Gibber )
      obj.Hex     = require( './hex.js'     )( Gibber ) 
      obj.Triggers= require( './triggers.js')( Gibber )

      //obj.gen = this.Gen.make
      //obj.lfo = this.Gen.composites.lfo
      //obj.Euclid = Euclid( this )
      //obj.Clock = this.Clock
      //obj.WavePattern = this.WavePattern
      //obj.Master = this.Master
      ////obj.Arp = this.Arp
      ////obj.Automata = this.Automata
      //obj.Out = this.Out
      //obj.Steps = this.Steps
      //obj.HexSteps = this.HexSteps
      //obj.Hex = this.Hex
      //obj.Triggers = this.Triggers
      //obj.Seq = this.Seq
      //obj.Tidal = this.Tidal
      //obj.future = this.Gibberish.utilities.future
    //}else{
    //  Gibber.exportTarget = obj
    //} 
  },

  // XXX stop clock from being cleared.
  clear() { 
    for( let plugin of Gibber.plugins ) {
      plugin.clear()
    }

    this.publish( 'clear' )
  },

  onload() {},

  createPubSub( obj ) {
    const events = {}
    obj.subscribe = function( key, fcn ) {
      if( typeof events[ key ] === 'undefined' ) {
        events[ key ] = []
      }
      events[ key ].push( fcn )
    }

    obj.unsubscribe = function( key, fcn ) {
      if( typeof events[ key ] !== 'undefined' ) {
        const arr = events[ key ]

        arr.splice( arr.indexOf( fcn ), 1 )
      }
    }

    obj.publish = function( key, data ) {
      if( typeof events[ key ] !== 'undefined' ) {
        const arr = events[ key ]

        arr.forEach( v => v( data ) )
      }
    }
  },

  // When a property is created, a proxy-ish object is made that is
  // prefaced by a double underscore. This object holds the value of the 
  // property, sequencers for the property, and modulations for the property.
  // Alternative getter/setter methods can be passed as arguments.
  createProperty( obj, name, value, post=null, priority=0, transform=null, isPoly=false ) {
    obj[ '__' + name ] = { 
      value,
      isProperty:true,
      sequencers:[],
      tidals:[],
      mods:[],
      name,

      seq( values, timings, number = 0, delay = 0 ) {
        if( value ) value.name = obj.name
        const type = obj.type === 'gen' ? 'audio' : obj.type
        Gibber[ type ].Seq({ 
          values, 
          timings, 
          target:obj,
          key:name,
          priority,
          delay,
          number,
          standalone:false,
          name:obj.name
        })
        
        return obj
      },

      tidal( pattern,  number = 0, delay = 0 ) {
        if( value ) value.name = obj.name
        const type = obj.type === 'gen' ? 'audio' : obj.type
        const s = Gibber[ type ].Tidal({ 
          pattern, 
          target:obj, 
          key:name,
          number,
          delay,
          standalone:false
        })

        // return object for method chaining
        return obj
      },

      fade( from=0, to=1, time=4 ) {
        Gibber[ obj.type ].createFade( from, to, time, obj, name )
        return obj
      }
    }

    Object.defineProperty( obj, name, {
      configurable:true,
      get: Gibber[ obj.type ].createGetter( obj, name ),
      set: Gibber[ obj.type ].createSetter( obj, name, post, transform, isPoly )
    })
  }
  
}

module.exports = Gibber 
