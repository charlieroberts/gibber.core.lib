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
        
        this.Pattern = this.__Pattern( this )
        this.Seq      = require( './seq.js'      )( this )
        this.Tidal    = require( './tidal.js'    )( this )
        this.Euclid   = require( './euclid.js'   )( this )
        this.Hex      = require( './hex.js'      )( this ) 
        this.Triggers = require( './triggers.js' )( this )
        this.Steps    = require( './steps.js'    )( this )

        values.forEach( v => {
          if( Array.isArray( v ) ) 
            this[ v[1] ] = v[0]
        })

        Gibber.publish( 'init' )
        
        resolve()
      })
    })
  
    return p
  },

  log( ...args ) {
    if( Gibber.Environment ) {
      Gibber.Environment.log( ...args )
    }else{
      console.log( ...args )
    }
  },

  error( ...args ) {
    if( Gibber.Environment ) {
      Gibber.Environment.error( ...args )
    }else{
      console.error( ...args )
    }
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
    obj.Steps = this.Steps

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
    this.Tidal.clear()

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
      type:obj.type,
      __owner:obj,

      fade( from=0, to=1, time=4, delay=0 ) {
        Gibber[ obj.type ].createFade( from, to, time, obj, name, delay )
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

  getType( obj ) {
    let type
    switch( from.type ) {
      case 'audio':
      case 'Audio':
        type = Gibber.Audio
        break
      case 'graphics':
      case 'Graphics':
        type = Gibber.Graphics
        break
      case 'gen':
        type = 'gen'
        break
    }

    return type
  },

  mappings: {},
  
  createMapping( from, to, name, wrappedTo ) {
    const fromlib = this.getType( from ),
          tolib   = this.getType( to )


    if( mappings[ tolib ] !== undefined &&
      mappings[ tolib ][ fromlib ] !== undefined ) {
      
      const mapper = mappings[ tolib ][ fromlib ]

      mapper( name, to, from )
    }

  
    //if( from.type === 'audio' ) {
    //  const f = to[ '__' + name ].follow = Follow({ input: from, bufferSize:4096 })

    //  Marching.callbacks.push( time => {
    //    if( f.output !== undefined ) {
    //      to[ name ] = f.output
    //    }
    //  })

    //  let m = f.multiplier
    //  Object.defineProperty( to[ name ], 'multiplier', {
    //    configurable:true,
    //    get() { return m },
    //    set(v) { m = v; f.multiplier = m }
    //  })

    //  let o = f.offset
    //  Object.defineProperty( to[ name ], 'offset', {
    //    configurable:true,
    //    get() { return o },
    //    set(v) { o = v; f.offset = o }
    //  })
    //}else if( from.type === 'gen' ) {
    //  const gen = from.render( 60, 'graphics' )

    //  // needed for annotations
    //  to[ name ].value.id = to[ name ].value.varName

    //  // XXX fix the two possible locations for the callback
    //  if( to[ name ].value.callback !== undefined ) {
    //    const idx = Marching.callbacks.indexOf( to[ name ].value.callback )
    //    Marching.callbacks.splice( idx, 1 )
    //  }else if( to[ '__'+name ].callback !== undefined ) {
    //    const idx = Marching.callbacks.indexOf( to[ '__'+name ].callback )
    //    Marching.callbacks.splice( idx, 1 )
    //  }

    //  // XXX fix the two possible locations for the callback
    //  if( typeof to[ name ].value === 'object' ) {
    //    to[ name ].value.callback = t => {
    //      const val = gen()
    //      to[ name ] = val
    //      //console.log( 'val:', val, to[ name ].value.widget !== undefined )
    //      let target = to[ name ].value.widget !== undefined ? to[ name ].value.widget : from.widget

    //      if( target === undefined && to[ name ].value.mark !== undefined ) 
    //        target = to[ name ].value.mark.replacedWith

    //      Gibber.Environment.codeMarkup.waveform.updateWidget( target, val, false )
    //    }
    //  }else{
    //    // assignment hack while DOM creation is taking place,
    //    // only needed for mappings to individual vector elements.
    //    if( to[ '__'+name ].widget === undefined ) {
    //      setTimeout( ()=> to[ '__'+name ].widget = gen.pre.widget, 150 )
    //    }

    //    to[ '__'+name ].callback = t => {
    //      const val = gen()
    //      to[ name ] = val
    //      Gibber.Environment.codeMarkup.waveform.updateWidget( to[ '__'+name ].widget, val, false )
    //    }
    //  }

    //  if( typeof to[ name ].value !== 'object' ) {
    //    Marching.callbacks.push( to[ '__'+name ].callback )
    //  }else{
    //    Marching.callbacks.push( to[ name ].value.callback )
    //  }
    //}
  },

  addSequencing( obj, name, priority, value, prefix='' ) {
    if( obj[ prefix+name ] === undefined ) obj[ prefix+name ] = {}

    obj[ prefix+name ].__owner = obj
    obj[ prefix+name ].__name = name
    obj[ prefix+name ].sequencers = []
    obj[ prefix+name ].seq = function ( values, timings, number = 0, delay = 0 ) {
      if( value !== undefined && typeof value === 'object' ) value.name = obj.name
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
      if( value !== undefined && typeof value !== 'number' ) value.name = obj.name
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
