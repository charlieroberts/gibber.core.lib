const Gibber = {
  initialized: false,
  exportTarget: null,
  plugins: [],
  // needed so audio plugin can transfer pattern function string to worklet
  __Pattern: require( './pattern.js' ),

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
    this.createPubSub( this )
    this.plugins = plugins

    const promises = []

    // init each plugin and collect promises
    for( let plugin of plugins ) {
      promises.push( 
        plugin.plugin.init( plugin.options, this ) 
      )
    }

    const p = new Promise( (resolve,reject) => {
      const finishedInitPromise = Promise.all( promises ).then( values => {
        Gibber.publish( 'init' )
        this.Pattern = this.__Pattern( this )
        this.Seq      = require( './seq.js'      )( this )
        this.Tidal    = require( './tidal.js'    )( this )
        this.Euclid   = require( './euclid.js'   )( this )
        this.Hex      = require( './hex.js'      )( this ) 
        this.Triggers = require( './triggers.js' )( this )
        this.Steps    = require( './steps.js'    )( this )
        resolve()
      })
    })
  
    return p
  },

  export( obj ) {
    // XXX must keep reference to main pattern function
    // so it can be serialized and transferred to audioworklet  
    obj.Pattern  = this.Pattern
    obj.Seq = this.Seq
    obj.Tidal = this.Tidal
    obj.Euclid = this.Euclid
    obj.Hex = this.Hex
    obj.Triggers = this.Triggers

    this.plugins.forEach( p => {
      p.plugin.export( obj, Gibber ) 
    })

    //obj.Clock = this.Clock
    //obj.WavePattern = this.WavePattern
  },

  // XXX stop clock from being cleared.
  clear() { 
    for( let plugin of Gibber.plugins ) {
      plugin.plugin.clear()
    }

    this.Seq.clear()

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

      fade( from=0, to=1, time=4 ) {
        Gibber[ obj.type ].createFade( from, to, time, obj, name )
        return obj
      }
    }

    Gibber.addSequencing( obj, name, priority, value, '__' )

    Object.defineProperty( obj, name, {
      configurable:true,
      get: Gibber[ obj.type ].createGetter( obj, name ),
      set: Gibber[ obj.type ].createSetter( obj, name, post, transform, isPoly )
    })
  },

  addSequencing( obj, name, priority, value, prefix='' ) {
    obj[ prefix+name ].sequencers = []
    obj[ prefix+name ].seq = function ( values, timings, number = 0, delay = 0 ) {
      if( value !== undefined ) value.name = obj.name
      const type = obj.type === 'gen' ? 'audio' : obj.type
      Gibber.Seq({ 
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
    }

    obj[ prefix+name ].tidal = function( pattern,  number = 0, delay = 0 ) {
      if( value !== undefined ) value.name = obj.name
      const type = obj.type === 'gen' ? 'audio' : obj.type
      const s = Gibber.Tidal({ 
        pattern, 
        target:obj, 
        key:name,
        number,
        delay,
        standalone:false
      })

      // return object for method chaining
      return obj
    }
  }
  
}

module.exports = Gibber 
