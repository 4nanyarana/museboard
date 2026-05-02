document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const notesGrid = document.getElementById('notesGrid');
    const noResultsMsg = document.getElementById('noResultsMsg');
    const searchInput = document.getElementById('searchInput');
    const themeToggle = document.getElementById('themeToggle');
    const addNoteBtn = document.getElementById('addNoteBtn');
    const undoBtn = document.getElementById('undoBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const boardContainer = document.getElementById('boardContainer');
    
    // Modal Elements
    const noteModal = document.getElementById('noteModal');
    const closeBtns = document.querySelectorAll('.close-modal');
    const noteForm = document.getElementById('noteForm');
    const noteIdInput = document.getElementById('noteId');
    const noteContentInput = document.getElementById('noteContent');
    const noteCategoryInput = document.getElementById('noteCategory');
    const noteColorInput = document.getElementById('noteColor');
    const modalTitle = document.getElementById('modalTitle');

    // State
    let notes = JSON.parse(localStorage.getItem('museboard_notes')) || [];
    let historyStack = []; // Array of previous 'notes' states for undo
    let currentCategory = 'all';

    // Initialize
    initTheme();
    initCategories();
    renderNotes();
    updateUndoBtn();
    
    function initCategories() {
        const categoryBtns = document.querySelectorAll('.category-btn');
        categoryBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                categoryBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentCategory = btn.getAttribute('data-category');
                renderNotes(searchInput.value);
            });
        });
    }

    // --- 1. Theme Management ---
    function initTheme() {
        const savedTheme = localStorage.getItem('theme');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
            document.documentElement.setAttribute('data-theme', 'dark');
            themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
        }

        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            if (currentTheme === 'dark') {
                document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('theme', 'light');
                themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
                themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
            }
        });
    }

    // --- 2. Data Management (LocalStorage & Undo) ---
    function saveNotes(newNotesState) {
        // Push current state to history before saving new state
        historyStack.push(JSON.stringify(notes));
        if (historyStack.length > 20) historyStack.shift(); // keep last 20 actions
        
        notes = newNotesState;
        localStorage.setItem('museboard_notes', JSON.stringify(notes));
        
        renderNotes(searchInput.value);
        updateUndoBtn();
    }

    function undoLastAction() {
        if (historyStack.length === 0) return;
        
        // Pop the last state
        const previousStateStr = historyStack.pop();
        notes = JSON.parse(previousStateStr);
        
        // Save to local storage without pushing to history again
        localStorage.setItem('museboard_notes', JSON.stringify(notes));
        
        renderNotes(searchInput.value);
        updateUndoBtn();
    }

    function updateUndoBtn() {
        if (historyStack.length > 0) {
            undoBtn.disabled = false;
            undoBtn.style.opacity = '1';
        } else {
            undoBtn.disabled = true;
            undoBtn.style.opacity = '0.5';
        }
    }

    undoBtn.addEventListener('click', undoLastAction);
    
    // Ctrl+Z shortcut
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            undoLastAction();
        }
    });

    // --- 3. Rendering Notes ---
    function renderNotes(searchTerm = '') {
        notesGrid.innerHTML = '';
        
        let filteredNotes = notes;
        if (currentCategory !== 'all') {
            filteredNotes = filteredNotes.filter(n => n.category === currentCategory);
        }
        
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filteredNotes = filteredNotes.filter(n => n.content.toLowerCase().includes(term));
        }

        if (filteredNotes.length === 0) {
            noResultsMsg.classList.remove('hidden');
        } else {
            noResultsMsg.classList.add('hidden');
            
            // Sort by latest first
            filteredNotes.sort((a, b) => b.timestamp - a.timestamp);
            
            filteredNotes.forEach(note => {
                const card = document.createElement('div');
                card.className = 'note-card';
                card.style.backgroundColor = note.color;
                
                // Calculate contrast for text color based on background
                const hex = note.color.replace('#', '');
                const r = parseInt(hex.substr(0, 2), 16);
                const g = parseInt(hex.substr(2, 2), 16);
                const b = parseInt(hex.substr(4, 2), 16);
                const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
                const textColor = (yiq >= 128) ? '#1a1a1a' : '#ffffff';
                card.style.color = textColor;

                const dateStr = new Date(note.timestamp).toLocaleDateString();

                card.innerHTML = `
                    <div class="note-content">${escapeHTML(note.content)}</div>
                    <div class="note-meta" style="border-top-color: ${textColor}33">
                        <span style="font-weight: 600; margin-right: 8px;">#${note.category || 'Other'}</span>
                        Last edited: ${dateStr}
                    </div>
                    <div class="note-actions">
                        <button class="action-btn edit-btn" data-id="${note.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
                        <button class="action-btn delete delete-btn" data-id="${note.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                    </div>
                `;
                
                notesGrid.appendChild(card);
            });

            // Attach listeners to newly created buttons
            document.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', (e) => openModal(e.currentTarget.getAttribute('data-id')));
            });
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => deleteNote(e.currentTarget.getAttribute('data-id')));
            });
        }
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }

    // --- 4. Modal & Form Logic ---
    function openModal(id = null) {
        if (id) {
            const note = notes.find(n => n.id === id);
            if (note) {
                modalTitle.textContent = 'Edit Note';
                noteIdInput.value = note.id;
                noteContentInput.value = note.content;
                noteColorInput.value = note.color;
                noteCategoryInput.value = note.category || 'Other';
            }
        } else {
            modalTitle.textContent = 'Add Note';
            noteIdInput.value = '';
            noteContentInput.value = '';
            noteCategoryInput.value = 'Minimalist';
            // Random pastel color
            const colors = ['#fdfd96', '#ffb7b2', '#ffdac1', '#e2f0cb', '#b5ead7', '#c7ceea', '#ffffff'];
            noteColorInput.value = colors[Math.floor(Math.random() * colors.length)];
        }
        noteModal.classList.remove('hidden');
        noteContentInput.focus();
    }

    function closeModal() {
        noteModal.classList.add('hidden');
    }

    addNoteBtn.addEventListener('click', () => openModal());
    closeBtns.forEach(btn => btn.addEventListener('click', closeModal));

    noteForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const id = noteIdInput.value;
        const content = noteContentInput.value.trim();
        const color = noteColorInput.value;
        const category = noteCategoryInput.value;
        
        if (!content) return;

        let newNotes = [...notes];

        if (id) {
            // Edit
            const index = newNotes.findIndex(n => n.id === id);
            if (index !== -1) {
                newNotes[index] = { ...newNotes[index], content, color, category, timestamp: Date.now() };
            }
        } else {
            // Create
            newNotes.push({
                id: Date.now().toString(),
                content,
                color,
                category,
                timestamp: Date.now()
            });
        }

        saveNotes(newNotes);
        closeModal();
    });

    function deleteNote(id) {
        if(confirm('Are you sure you want to delete this note?')) {
            const newNotes = notes.filter(n => n.id !== id);
            saveNotes(newNotes);
        }
    }

    // --- 5. Search ---
    searchInput.addEventListener('input', (e) => {
        renderNotes(e.target.value);
    });

    // --- 6. Download as Image (html2canvas) ---
    downloadBtn.addEventListener('click', () => {
        downloadBtn.disabled = true;
        const originalText = downloadBtn.innerHTML;
        downloadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        
        // Wait for font rendering just in case
        setTimeout(() => {
            html2canvas(boardContainer, {
                backgroundColor: getComputedStyle(document.body).backgroundColor,
                scale: 2, // Higher resolution
                useCORS: true
            }).then(canvas => {
                // Create download link
                const link = document.createElement('a');
                link.download = `MuseBoard_${new Date().toLocaleDateString().replace(/\//g, '-')}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                
                // Reset button
                downloadBtn.innerHTML = originalText;
                downloadBtn.disabled = false;
            }).catch(err => {
                console.error('Error capturing board:', err);
                alert('Failed to generate image.');
                downloadBtn.innerHTML = originalText;
                downloadBtn.disabled = false;
            });
        }, 100);
    });
});
