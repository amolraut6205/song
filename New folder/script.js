// Configuration
const YOUTUBE_API_KEY = 'AIzaSyB78xVMv49AGk1JbsBFCK-iwRvj55k8px4'; // Never expose this in production!
const MAX_RESULTS = 10;

// Global variables
let player;
let currentVideoId = '';
let currentPlaylist = [];
let currentTrackIndex = 0;
let isPlaying = false;
let isShuffleOn = false;
let isRepeatOn = false;
let volume = 50;
let playlists = JSON.parse(localStorage.getItem('playlists')) || [];
let searchResults = [];

// DOM Elements
const playBtn = document.getElementById('play-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const shuffleBtn = document.getElementById('shuffle-btn');
const repeatBtn = document.getElementById('repeat-btn');
const volumeSlider = document.getElementById('volume-slider');
const progress = document.getElementById('progress');
const progressContainer = document.querySelector('.progress-container');
const currentTimeEl = document.getElementById('current-time');
const durationEl = document.getElementById('duration');
const searchInput = document.getElementById('search-input');
const searchResultsContainer = document.getElementById('search-results');
const playlistList = document.getElementById('playlist-list');
const createPlaylistBtn = document.getElementById('create-playlist-btn');
const playlistModal = document.getElementById('playlist-modal');
const closeModalBtn = document.querySelector('.close-btn');
const savePlaylistBtn = document.getElementById('save-playlist-btn');
const playlistNameInput = document.getElementById('playlist-name-input');
const userPlaylistsContainer = document.getElementById('user-playlists');
const currentSongTitle = document.getElementById('current-song-title');
const currentSongArtist = document.getElementById('current-song-artist');
const currentSongCover = document.getElementById('current-song-cover');

// Initialize the app
function init() {
    // Load playlists from localStorage
    loadPlaylists();
    
    // Event listeners
    setupEventListeners();
}

// Called when YouTube API is ready
function onYouTubeIframeAPIReady() {
    player = new YT.Player('youtube-player', {
        height: '0',
        width: '0',
        playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            rel: 0
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

// Called when YouTube player is ready
function onPlayerReady(event) {
    console.log('YouTube player ready');
    player.setVolume(volume);
}

// Called when player state changes
function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.ENDED) {
        if (isRepeatOn) {
            player.playVideo();
        } else {
            playNext();
        }
    } else if (event.data === YT.PlayerState.PLAYING) {
        isPlaying = true;
        updatePlayPauseIcon();
        updateProgress();
    } else if (event.data === YT.PlayerState.PAUSED) {
        isPlaying = false;
        updatePlayPauseIcon();
    } else if (event.data === YT.PlayerState.BUFFERING) {
        // Show loading state if needed
    }
}

// Update progress bar
function updateProgress() {
    if (!player || !isPlaying) return;
    
    const duration = player.getDuration();
    const currentTime = player.getCurrentTime();
    const progressPercent = (currentTime / duration) * 100;
    progress.style.width = `${progressPercent}%`;
    
    // Update time display
    currentTimeEl.textContent = formatTime(currentTime);
    durationEl.textContent = formatTime(duration);
    
    // Continue updating
    requestAnimationFrame(updateProgress);
}

// Format time in mm:ss
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Setup event listeners
function setupEventListeners() {
    // Player controls
    playBtn.addEventListener('click', togglePlay);
    prevBtn.addEventListener('click', playPrevious);
    nextBtn.addEventListener('click', playNext);
    shuffleBtn.addEventListener('click', toggleShuffle);
    repeatBtn.addEventListener('click', toggleRepeat);
    
    // Progress bar click
    progressContainer.addEventListener('click', setProgress);
    
    // Volume control
    volumeSlider.addEventListener('input', setVolume);
    
    // Search functionality
    searchInput.addEventListener('input', debounce(handleSearch, 500));
    
    // Playlist management
    createPlaylistBtn.addEventListener('click', openPlaylistModal);
    closeModalBtn.addEventListener('click', closePlaylistModal);
    savePlaylistBtn.addEventListener('click', savePlaylist);
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === playlistModal) {
            closePlaylistModal();
        }
    });
}

// Toggle play/pause
function togglePlay() {
    if (!currentVideoId) return;
    
    if (isPlaying) {
        player.pauseVideo();
    } else {
        player.playVideo();
    }
}

// Play previous track
function playPrevious() {
    if (currentPlaylist.length === 0) return;
    
    currentTrackIndex--;
    if (currentTrackIndex < 0) {
        currentTrackIndex = currentPlaylist.length - 1;
    }
    
    loadTrack(currentTrackIndex);
}

// Play next track
function playNext() {
    if (currentPlaylist.length === 0) return;
    
    if (isShuffleOn) {
        currentTrackIndex = Math.floor(Math.random() * currentPlaylist.length);
    } else {
        currentTrackIndex++;
        if (currentTrackIndex >= currentPlaylist.length) {
            currentTrackIndex = 0;
        }
    }
    
    loadTrack(currentTrackIndex);
}

// Toggle shuffle
function toggleShuffle() {
    isShuffleOn = !isShuffleOn;
    shuffleBtn.style.color = isShuffleOn ? 'var(--primary-color)' : 'var(--text-secondary)';
}

// Toggle repeat
function toggleRepeat() {
    isRepeatOn = !isRepeatOn;
    repeatBtn.style.color = isRepeatOn ? 'var(--primary-color)' : 'var(--text-secondary)';
}

// Set progress bar position
function setProgress(e) {
    if (!player) return;
    
    const width = this.clientWidth;
    const clickX = e.offsetX;
    const duration = player.getDuration();
    player.seekTo((clickX / width) * duration);
}

// Set volume
function setVolume() {
    volume = this.value;
    player.setVolume(volume);
}

// Update play/pause icon
function updatePlayPauseIcon() {
    const icon = playBtn.querySelector('i');
    icon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
}

// Handle search with debounce
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(this, args);
        }, wait);
    };
}

// Handle search
async function handleSearch() {
    const query = searchInput.value.trim();
    if (query.length < 3) {
        searchResultsContainer.innerHTML = '';
        return;
    }

    try {
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=${MAX_RESULTS}&q=${encodeURIComponent(query)}&type=video&key=${YOUTUBE_API_KEY}`
        );
        
        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.items || data.items.length === 0) {
            searchResultsContainer.innerHTML = '<p>No results found</p>';
            return;
        }
        
        searchResults = data.items.filter(item => item.id.videoId);
        displaySearchResults(searchResults);
    } catch (error) {
        console.error('Search error:', error);
        searchResultsContainer.innerHTML = '<p>Error loading search results</p>';
        
        // Fallback to mock data
        searchResults = await getMockData();
        displaySearchResults(searchResults);
    }
}

// Mock data for fallback/demo
async function getMockData() {
    return [
        {
            id: { videoId: 'dQw4w9WgXcQ' },
            snippet: {
                title: 'Never Gonna Give You Up',
                channelTitle: 'Rick Astley',
                thumbnails: {
                    medium: { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg' }
                }
            }
        },
        {
            id: { videoId: '9bZkp7q19f0' },
            snippet: {
                title: 'Gangnam Style',
                channelTitle: 'PSY',
                thumbnails: {
                    medium: { url: 'https://i.ytimg.com/vi/9bZkp7q19f0/mqdefault.jpg' }
                }
            }
        }
    ];
}

// Display search results
function displaySearchResults(results) {
    searchResultsContainer.innerHTML = '';
    
    if (!results || results.length === 0) {
        searchResultsContainer.innerHTML = '<p>No results found</p>';
        return;
    }
    
    results.forEach((item, index) => {
        if (!item.id.videoId) return;
        
        const videoId = item.id.videoId;
        const title = item.snippet.title;
        const artist = item.snippet.channelTitle;
        const thumbnail = item.snippet.thumbnails?.medium?.url || '';
        
        const songCard = document.createElement('div');
        songCard.className = 'song-card';
        songCard.dataset.index = index;
        songCard.innerHTML = `
            <div class="song-cover">
                ${thumbnail ? `<img src="${thumbnail}" alt="${title}">` : '<i class="fas fa-music"></i>'}
                <div class="play-icon">
                    <i class="fas fa-play"></i>
                </div>
            </div>
            <div class="song-title">${title}</div>
            <div class="song-artist">${artist}</div>
        `;
        
        songCard.addEventListener('click', () => playSongFromSearch(index));
        searchResultsContainer.appendChild(songCard);
    });
}

// Play song from search results
function playSongFromSearch(index) {
    try {
        const song = searchResults[index];
        if (!song?.id?.videoId) {
            throw new Error('Invalid song data');
        }
        
        currentVideoId = song.id.videoId;
        currentPlaylist = [song];
        currentTrackIndex = 0;
        
        player.loadVideoById(currentVideoId);
        player.playVideo();
        
        updateNowPlaying(
            song.snippet.title,
            song.snippet.channelTitle,
            song.snippet.thumbnails?.medium?.url
        );
    } catch (error) {
        console.error('Error playing song:', error);
        alert('Could not play this song. Please try another one.');
    }
}

// Update now playing info
function updateNowPlaying(title, artist, coverUrl) {
    currentSongTitle.textContent = title;
    currentSongArtist.textContent = artist;
    
    if (coverUrl) {
        currentSongCover.innerHTML = `<img src="${coverUrl}" alt="${title}">`;
    } else {
        currentSongCover.innerHTML = '<i class="fas fa-music"></i>';
    }
}

// Load track from playlist
function loadTrack(index) {
    const track = currentPlaylist[index];
    currentVideoId = track.id.videoId;
    
    player.loadVideoById(currentVideoId);
    player.playVideo();
    
    updateNowPlaying(track.snippet.title, track.snippet.channelTitle, track.snippet.thumbnails?.medium?.url);
}

// Load playlists from localStorage
function loadPlaylists() {
    playlistList.innerHTML = '';
    userPlaylistsContainer.innerHTML = '';
    
    if (playlists.length === 0) {
        playlistList.innerHTML = '<li>No playlists yet</li>';
        userPlaylistsContainer.innerHTML = '<p>Create your first playlist</p>';
        return;
    }
    
    playlists.forEach((playlist, index) => {
        // Add to sidebar list
        const playlistItem = document.createElement('li');
        playlistItem.textContent = playlist.name;
        playlistItem.dataset.index = index;
        playlistItem.addEventListener('click', () => viewPlaylist(index));
        playlistList.appendChild(playlistItem);
        
        // Add to playlists grid
        const playlistCard = document.createElement('div');
        playlistCard.className = 'playlist-card';
        playlistCard.dataset.index = index;
        playlistCard.innerHTML = `
            <div class="song-cover">
                <i class="fas fa-list"></i>
            </div>
            <div class="song-title">${playlist.name}</div>
            <div class="song-artist">${playlist.songs.length} songs</div>
        `;
        playlistCard.addEventListener('click', () => viewPlaylist(index));
        userPlaylistsContainer.appendChild(playlistCard);
    });
}

// View playlist
function viewPlaylist(index) {
    const playlist = playlists[index];
    currentPlaylist = playlist.songs;
    
    if (currentPlaylist.length > 0) {
        currentTrackIndex = 0;
        loadTrack(currentTrackIndex);
    }
}

// Open playlist creation modal
function openPlaylistModal() {
    playlistModal.style.display = 'flex';
    playlistNameInput.focus();
}

// Close playlist creation modal
function closePlaylistModal() {
    playlistModal.style.display = 'none';
    playlistNameInput.value = '';
}

// Save new playlist
function savePlaylist() {
    const name = playlistNameInput.value.trim();
    if (!name) return;
    
    const newPlaylist = {
        name: name,
        songs: []
    };
    
    playlists.push(newPlaylist);
    savePlaylistsToStorage();
    loadPlaylists();
    closePlaylistModal();
}

// Save playlists to localStorage
function savePlaylistsToStorage() {
    localStorage.setItem('playlists', JSON.stringify(playlists));
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);