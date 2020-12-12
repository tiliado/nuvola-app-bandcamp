/*
 * Copyright 2014-2020 Jiří Janoušek <janousek.jiri@gmail.com>
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

'use strict';

(function (Nuvola) {
  // Create media player component
  const player = Nuvola.$object(Nuvola.MediaPlayer)

  // Handy aliases
  const PlaybackState = Nuvola.PlaybackState
  const PlayerAction = Nuvola.PlayerAction

  // Create new WebApp prototype
  const WebApp = Nuvola.$WebApp()

  // Initialization routines
  WebApp._onInitWebWorker = function (emitter) {
    Nuvola.WebApp._onInitWebWorker.call(this, emitter)

    const state = document.readyState
    if (state === 'interactive' || state === 'complete') {
      this._onPageReady()
    } else {
      document.addEventListener('DOMContentLoaded', this._onPageReady.bind(this))
    }
  }

  // Page is ready for magic
  WebApp._onPageReady = function () {
    this.playButton = null
    this.section = null
    // Connect handler for signal ActionActivated
    Nuvola.actions.connect('ActionActivated', this)

    // Start update routine
    this.update()
  }

  // Extract data from the web page
  WebApp.update = function () {
    const prevSection = this.section
    const SECTION_WEEKLY = 1
    const SECTION_DISCOVER = 2
    const SECTION_ALBUM_VIEW = 3
    const SECTION_TRACK_VIEW = 4

    let state = PlaybackState.UNKNOWN
    let playButton = null
    let canPrev = false
    let canNext = false

    const track = {
      title: null,
      artist: null,
      album: null,
      artLocation: null
    }

    // Try to find Bandcamp Weekly section at the top of the home page
    const weekly = !!document.querySelector('#bcweekly')
    let weeklyState = PlaybackState.UNKNOWN
    let weeklyPlayButton
    if (weekly) {
      const weeklyPlaying = !!document.querySelector('#bcweekly-inner.playing')
      weeklyPlayButton = document.querySelector('#bcweekly .play-btn .icon')
      weeklyState = weeklyPlaying ? PlaybackState.PLAYING : (weeklyPlayButton ? PlaybackState.PAUSED : PlaybackState.UNKNOWN)

      /* If the Weekly section exists, make it a default section,
   * so user can use play action to start music playback immediately.
   */
      if (weeklyPlaying || this.section === null) { this.section = SECTION_WEEKLY }
    }

    // Try to find Discover section in the middle of the home page
    const discover = !!document.querySelector('.discover-detail')
    let discoverState = PlaybackState.UNKNOWN
    let discoverPlayButton
    if (discover) {
      discoverPlayButton = document.querySelector('.discover-detail .playbutton')
      const discoverPlayButtonPlaying = !!document.querySelector('.discover-detail .playbutton.playing')

      if (!discoverPlayButton) {
        discoverState = PlaybackState.UNKNOWN
      } else if (discoverPlayButtonPlaying) {
        this.section = SECTION_DISCOVER
        discoverState = PlaybackState.PLAYING
      } else {
      // this.section = SECTION_DISCOVER;
        discoverState = PlaybackState.PAUSED
      }
    }

    // Check whether we are in album view
    let albumViewState = PlaybackState.UNKNOWN
    let albumViewPlayButton
    if (!weekly && !discover) {
      albumViewPlayButton = document.querySelector('#trackInfo .playbutton')
      const albumViewPlaying = !!document.querySelector('#trackInfo .playbutton.playing')
      albumViewState = albumViewPlaying ? PlaybackState.PLAYING : (albumViewPlayButton ? PlaybackState.PAUSED : PlaybackState.UNKNOWN)
      if (albumViewPlayButton) {
        this.section = document.querySelector('#name-section h3.albumTitle') ? SECTION_TRACK_VIEW : SECTION_ALBUM_VIEW
      }
    }

    let elm
    if (this.section === SECTION_WEEKLY) { // Bandcamp Weekly section at the top of the home page
      track.title = (Nuvola.queryText('.bcweekly-current .track-large .track-title') ||
        Nuvola.queryText('.bcweekly-player .bcweekly-title'))
      track.album = Nuvola.queryText('.bcweekly-current .track-large .track-album')
      track.artist = Nuvola.queryText('.bcweekly-current .track-large .track-artist a')
      track.artLocation = Nuvola.queryAttribute('.bcweekly-current .track-large  .popupImage img', 'src')
      playButton = weeklyPlayButton
      state = weeklyState
    } else if (this.section === SECTION_DISCOVER) { // Discover section in the middle of the home page
      track.title = Nuvola.queryText('.discover-detail .track_info .title-section .title')
      track.album = Nuvola.queryText('.discover-detail .detail-album a')
      track.artist = Nuvola.queryText('.discover-detail .detail-artist a')
      track.artLocation = Nuvola.queryAttribute('.discover-detail .detail_art img', 'src')
      state = discoverState
      playButton = discoverPlayButton
    } else if (this.section === SECTION_ALBUM_VIEW) { // Album view
      track.title = Nuvola.queryText('.trackView .track_info .title')
      track.album = Nuvola.queryText('.trackView .trackTitle')
      track.artist = Nuvola.queryText('.trackView #name-section h3 span')
      track.artLocation = (Nuvola.queryAttribute('.trackView img.popupImage', 'src') ||
        Nuvola.queryAttribute('a.popupImage img', 'src'))
      state = albumViewState
      playButton = albumViewPlayButton
      canNext = (elm = document.querySelector('#trackInfo .nextbutton')) && !elm.classList.contains('hiddenelem')
      canPrev = (elm = document.querySelector('#trackInfo .prevbutton')) && !elm.classList.contains('hiddenelem')
    } else if (this.section === SECTION_TRACK_VIEW) {
      track.title = Nuvola.queryText('.trackView h2.trackTitle')
      track.album = Nuvola.queryText('.trackView .albumTitle span.fromAlbum')
      track.artist = Nuvola.queryText('.trackView #name-section h3.albumTitle > span:last-child')
      track.artLocation = (Nuvola.queryAttribute('.trackView img.popupImage', 'src') ||
        Nuvola.queryAttribute('a.popupImage img', 'src'))
      state = albumViewState
      playButton = albumViewPlayButton
      canNext = (elm = document.querySelector('#trackInfo .nextbutton')) && !elm.classList.contains('hiddenelem')
      canPrev = (elm = document.querySelector('#trackInfo .prevbutton')) && !elm.classList.contains('hiddenelem')
    }

    const timeElapsed = Nuvola.queryText('#trackInfo .time .time_elapsed')
    track.length = timeElapsed ? Nuvola.queryText('#trackInfo .time .time_total') : null

    // Save state
    this.state = state
    this.playButton = playButton
    player.setTrack(track)
    player.setTrackPosition(timeElapsed)
    player.setPlaybackState(state)
    player.setCanGoPrev(canPrev)
    player.setCanGoNext(canNext)
    player.setCanPlay(state === PlaybackState.PAUSED)
    player.setCanPause(state === PlaybackState.PLAYING)

    if (prevSection !== this.section) {
      console.log('Section ' + prevSection + ' → ' + this.section)
    }
    // Schedule the next update
    setTimeout(this.update.bind(this), 500)
  }

  // Handler of playback actions
  WebApp._onActionActivated = function (emitter, name, param) {
    switch (name) {
      case PlayerAction.TOGGLE_PLAY:
      case PlayerAction.PLAY:
      case PlayerAction.PAUSE:
      case PlayerAction.STOP:
        if (this.playButton) {
          Nuvola.clickOnElement(this.playButton)
        } else {
          Nuvola.warn("Play button not found for '{1}', section {2}", name, this.section)
        }
        break
      case PlayerAction.PREV_SONG:
        Nuvola.clickOnElement(document.querySelector('#trackInfo .prevbutton'))
        break
      case PlayerAction.NEXT_SONG:
        Nuvola.clickOnElement(document.querySelector('#trackInfo .nextbutton'))
        break
    }
  }

  WebApp._onNavigationRequest = function (emitter, request) {
    Nuvola.WebApp._onNavigationRequest(emitter, request)
    // Don't open album from collections in a new window
    if (request.approved) { request.newWindow = false }
  }

  WebApp.start()
})(this) // function(Nuvola)
