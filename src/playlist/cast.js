// Rewrite for Manifest V3 extension pages using the Presentation API
class CastManager {
  constructor() {
    this.presentationRequest = null;
    this.presentationConnection = null;
    this.isCasting = false;
    this.videoElement = null;

    // Remote state matching our player
    this.remoteState = {
      paused: true,
      currentTime: 0,
      duration: 0,
      volume: 1,
      muted: false
    };

    // Callbacks
    this.onStateChange = null;
    this.onTimeUpdate = null;
    this.onVolumeChange = null;
    this.onError = null;

    this._initialized = false;
  }

  async init(videoElement) {
    if (this._initialized) return;
    this.videoElement = videoElement;

    // Use default generic receiver or custom one if needed
    // The default media receiver app id is CC1AD845, cast URL is cast:CC1AD845
    // However, Presentation API works best with standard cast:// URIs
    const castUrls = [
      'cast:CC1AD845',
      'https://www.youtube.com/tv' // Fallback example if we ever need it
    ];

    if (window.PresentationRequest) {
      try {
        this.presentationRequest = new PresentationRequest(castUrls);

        // Listen for availability (if a cast device is on network)
        this.presentationRequest.getAvailability().then(availability => {
          console.log("📺 Cast availability:", availability.value);
          availability.onchange = () => {
            console.log("📺 Cast availability changed:", availability.value);
          };
        }).catch(err => console.log('Availability not supported', err));

        // Handle incoming connections if receiver connects back
        if (navigator.presentation && 'defaultRequest' in navigator.presentation) {
          navigator.presentation.defaultRequest = this.presentationRequest;
        }

        this.presentationRequest.addEventListener('connectionavailable', (event) => {
          this._setupConnection(event.connection);
        });

        this._initialized = true;
        console.log('🔗 CastManager initialized (Presentation API)');
      } catch (e) {
        console.warn('Presentation API unavailable', e);
      }
    } else {
      console.warn('Presentation API not supported in this browser context');
    }
  }

  _setupConnection(connection) {
    this.presentationConnection = connection;
    this.isCasting = true;
    console.log('📺 Cast Connection Established', connection.state);

    if (this.videoElement && !this.videoElement.paused) {
      this.videoElement.pause();
    }

    // We send a custom payload to the receiver
    // Note: A default media receiver (CC1AD845) expects a specific JSON format or SDK payload.
    // Since we are bypassing the SDK, we simulate the 'load' message over the Presentation Connection message channel.

    connection.addEventListener('message', (event) => {
      this._handleRemoteMessage(event.data);
    });

    connection.addEventListener('close', () => {
      console.log('📺 Cast Connection Closed');
      this.isCasting = false;
      this.presentationConnection = null;
      if (this.onStateChange) this.onStateChange(false);
    });

    connection.addEventListener('terminate', () => {
      console.log('📺 Cast Connection Terminated');
      this.isCasting = false;
      this.presentationConnection = null;
      if (this.onStateChange) this.onStateChange(false);
    });

    if (this.onStateChange) this.onStateChange(true);
  }

  _handleRemoteMessage(data) {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'MEDIA_STATUS') {
        const status = msg.status[0];
        if (!status) return;

        this.remoteState.paused = status.playerState !== 'PLAYING';
        this.remoteState.currentTime = status.currentTime;
        if (status.media && status.media.duration) {
          this.remoteState.duration = status.media.duration;
        }

        if (this.onStateChange) this.onStateChange(!this.remoteState.paused);
        if (this.onTimeUpdate) this.onTimeUpdate(this.remoteState.currentTime, this.remoteState.duration);
      }
    } catch (e) {
      console.log("Raw cast msg:", data);
    }
  }

  _sendMessage(payload) {
    if (this.presentationConnection && this.presentationConnection.state === 'connected') {
      try {
        this.presentationConnection.send(JSON.stringify(payload));
      } catch (e) {
        console.error('Failed to send cast message', e);
      }
    }
  }

  // --- Public API for UI to Call ---

  async toggleCastMenu() {
    // If not initialized, fallback to request chrome.tabs casting if possible
    if (!this._initialized || !this.presentationRequest) {
      console.warn("Presentation API not available, attempting native fallback");
      alert("Tu navegador no soporta Google Cast o lo tiene desactivado (ej. Brave sin habilitar Media Router). Prueba haciendo clic derecho en la página y luego en 'Enviar / Cast'.");
      return;
    }
    try {
      // This triggers the native Chrome Cast dialog
      const connection = await this.presentationRequest.start();
      this._setupConnection(connection);
    } catch (e) {
      console.log('Cast session request cancelled or failed', e);
      if (this.onError) {
        const errorMsg = e.name === 'NotFoundError'
          ? 'No se encontraron pantallas'
          : 'Error al iniciar Cast';
        this.onError(errorMsg);
      }
    }
  }

  async loadMedia(videoObj) {
    if (!this.isCasting || !this.presentationConnection) return false;

    const { url, manifest, type, title } = videoObj;
    const mediaUrl = manifest || url;

    // Simulate standard Chromecast LOAD message
    const loadMsg = {
      type: 'LOAD',
      requestId: 1,
      media: {
        contentId: mediaUrl,
        streamType: type === 'hls' ? 'LIVE' : 'BUFFERED',
        contentType: type === 'hls' ? 'application/x-mpegurl' : 'video/mp4',
        metadata: {
          metadataType: 0,
          title: title || "Untitled Video"
        }
      },
      autoplay: true
    };

    this._sendMessage(loadMsg);
    this.remoteState.paused = false;
    if (this.onStateChange) this.onStateChange(true);
    return true;
  }

  playOrPause() {
    if (this.isCasting) {
      const isPlaying = !this.remoteState.paused;
      this._sendMessage({
        type: isPlaying ? 'PAUSE' : 'PLAY',
        requestId: 2
      });
      this.remoteState.paused = !this.remoteState.paused;
      if (this.onStateChange) this.onStateChange(!this.remoteState.paused);
      return true;
    }
    return false;
  }

  seek(timeInSeconds) {
    if (this.isCasting) {
      this._sendMessage({
        type: 'SEEK',
        requestId: 3,
        currentTime: timeInSeconds
      });
      this.remoteState.currentTime = timeInSeconds;
      if (this.onTimeUpdate) this.onTimeUpdate(this.remoteState.currentTime, this.remoteState.duration);
      return true;
    }
    return false;
  }

  setVolume(volumeLevel) {
    if (this.isCasting) {
      this.remoteState.volume = volumeLevel;
      this._sendMessage({
        type: 'SET_VOLUME',
        requestId: 4,
        volume: { level: volumeLevel }
      });
      if (this.onVolumeChange) this.onVolumeChange(volumeLevel, this.remoteState.muted);
      return true;
    }
    return false;
  }

  toggleMute() {
    if (this.isCasting) {
      this.remoteState.muted = !this.remoteState.muted;
      this._sendMessage({
        type: 'SET_VOLUME',
        requestId: 5,
        volume: { muted: this.remoteState.muted }
      });
      if (this.onVolumeChange) this.onVolumeChange(this.remoteState.volume, this.remoteState.muted);
      return true;
    }
    return false;
  }
}

export const castManager = new CastManager();
