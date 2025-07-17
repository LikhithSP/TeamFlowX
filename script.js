class TeamConnectionMap {
  constructor() {
    this.cy = null;
    this.data = null;
    this.filteredData = null;
    this.isLoading = true;
    this.config = {
      departments: {
        Engineering: { color: '#2563eb', icon: 'fas fa-code' },
        Design: { color: '#dc2626', icon: 'fas fa-palette' },
        Product: { color: '#f59e0b', icon: 'fas fa-lightbulb' },
        Marketing: { color: '#7c3aed', icon: 'fas fa-bullhorn' }
      },
      relationships: {
        manages: { width: 4, color: '#dc2626', arrow: 'triangle', label: 'Manages', style: 'solid' },
        collaborates: { width: 2, color: '#2563eb', arrow: 'triangle', label: 'Collaborates', style: 'solid' },
        mentored_by: { width: 3, color: '#f59e0b', arrow: 'triangle', label: 'Mentored by', style: 'dashed' },
        coordinates: { width: 2, color: '#7c3aed', arrow: 'triangle', label: 'Coordinates', style: 'dotted' }
      },
      layouts: {
        cose: { name: 'cose', padding: 50, nodeOverlap: 20, idealEdgeLength: 120, edgeElasticity: 100, nestingFactor: 1.2, gravity: 1, numIter: 1000, initialTemp: 1000, coolingFactor: 0.99, minTemp: 1.0 },
        circle: { name: 'circle', padding: 50, radius: 200, animate: true, animationDuration: 1000 },
        grid: { name: 'grid', padding: 50, rows: 3, animate: true, animationDuration: 1000 },
        breadthfirst: { name: 'breadthfirst', padding: 50, directed: true, spacingFactor: 1.5, animate: true, animationDuration: 1000 },
        concentric: { name: 'concentric', padding: 50, animate: true, animationDuration: 1000, concentric: n => n.degree(), levelWidth: () => 2 }
      }
    };
    this.init();
  }

  async init() {
    try {
      await this.loadData();
      this.initializeGraph();
      this.setupEventListeners();
      this.setupControls();
      this.updateStats();
      this.populateFilters();
      this.hideLoading();
    } catch (e) {
      console.error('Failed to initialize:', e);
      this.showError('Failed to load team data.');
    }
  }

  // API Configuration
  apiConfig = {
    baseUrl: 'https://jsonplaceholder.typicode.com', 
    endpoints: {
      teamData: '/users',
    },
    headers: {
      'Content-Type': 'application/json',
    }
  };

  loadData = async () => {
    try {
      this.showLoading && this.showLoading('Fetching team data...');
      const response = await fetch(`${this.apiConfig.baseUrl}${this.apiConfig.endpoints.teamData}`, {
        method: 'GET',
        headers: this.apiConfig.headers
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const apiData = await response.json();
      this.data = this.transformApiData(apiData);
      this.filteredData = JSON.parse(JSON.stringify(this.data));
    } catch (error) {
      console.error('Failed to load data from API:', error);
      console.log('Falling back to local data...');
      await this.loadLocalData();
    }
  };

  async loadLocalData() {
    try {
      const response = await fetch('data.json');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      this.data = await response.json();
      this.filteredData = JSON.parse(JSON.stringify(this.data));
    } catch (error) {
      throw new Error('Failed to load both API and local data: ' + error.message);
    }
  }

  transformApiData(apiData) {
    const nodes = apiData.map(user => ({
      data: {
        id: user.id.toString(),
        label: user.name,
        department: this.getDepartmentFromUser(user),
        role: this.getRoleFromUser(user),
        email: user.email,
        skills: this.getSkillsFromUser(user),
        experience: this.getExperienceFromUser(user)
      }
    }));
    const edges = this.generateSampleEdges(nodes);
    return { nodes, edges };
  }

  getDepartmentFromUser(user) {
    const departments = ['Engineering', 'Design', 'Product', 'Marketing'];
    return departments[user.id % departments.length];
  }

  getRoleFromUser(user) {
    const roles = ['Manager', 'Senior Developer', 'Developer', 'Designer', 'Product Manager'];
    return roles[user.id % roles.length];
  }

  getSkillsFromUser(user) {
    const skillSets = [
      ['Leadership', 'JavaScript', 'React'],
      ['Design', 'Figma', 'UI/UX'],
      ['Product Strategy', 'Analytics', 'User Research'],
      ['Marketing', 'SEO', 'Content Strategy']
    ];
    return skillSets[user.id % skillSets.length];
  }

  getExperienceFromUser(user) {
    const experience = (user.id % 10) + 1;
    return `${experience} years`;
  }

  generateSampleEdges(nodes) {
    const edges = [];
    const relationshipTypes = ['manages', 'collaborates', 'mentored_by', 'coordinates'];
    for (let i = 0; i < nodes.length - 1; i++) {
      const relationshipType = relationshipTypes[i % relationshipTypes.length];
      edges.push({
        data: {
          id: `${nodes[i].data.id}_${nodes[i + 1].data.id}`,
          source: nodes[i].data.id,
          target: nodes[i + 1].data.id,
          relationship: relationshipType,
          label: this.config.relationships[relationshipType].label
        }
      });
    }
    return edges;
  }

  initializeGraph() {
    this.cy = cytoscape({
      container: document.getElementById('cy'),
      elements: { nodes: this.filteredData.nodes, edges: this.filteredData.edges },
      style: this.getGraphStyles(),
      layout: this.config.layouts.cose,
      wheelSensitivity: 0.2, minZoom: 0.3, maxZoom: 3
    });
    this.cy.on('pan zoom', () => {
      const pan = this.cy.pan(), maxPan = 200;
      if (Math.abs(pan.x) > maxPan || Math.abs(pan.y) > maxPan)
        this.cy.pan({ x: Math.max(-maxPan, Math.min(maxPan, pan.x)), y: Math.max(-maxPan, Math.min(maxPan, pan.y)) });
    });
  }

  getGraphStyles() {
    const dept = this.config.departments, rel = this.config.relationships;
    return [
      { selector: 'node', style: { 'background-color': ele => dept[ele.data('department')]?.color || '#64748b', 'label': 'data(label)', 'color': '#fff', 'text-valign': 'center', 'text-halign': 'center', 'font-size': '11px', 'font-weight': '600', 'font-family': 'Inter, sans-serif', 'width': '70px', 'height': '70px', 'border-width': '3px', 'border-color': '#fff', 'text-wrap': 'wrap', 'text-max-width': '60px', 'overlay-opacity': 0, 'transition-property': 'background-color, border-color, width, height, border-width', 'transition-duration': '0.25s', 'transition-timing-function': 'ease-out', 'box-shadow': '0 4px 8px rgba(0,0,0,0.15)', 'z-index': 10 } },
      { selector: 'node:selected', style: { 'border-color': '#f59e0b', 'border-width': '5px', 'width': '80px', 'height': '80px', 'z-index': 999 } },
      { selector: 'node:hover', style: { 'border-color': '#f59e0b', 'border-width': '4px', 'cursor': 'pointer' } },
      { selector: 'edge', style: { 'width': ele => rel[ele.data('relationship')]?.width || 2, 'line-color': ele => rel[ele.data('relationship')]?.color || '#64748b', 'target-arrow-color': ele => rel[ele.data('relationship')]?.color || '#64748b', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier', 'opacity': 0.8, 'overlay-opacity': 0, 'transition-property': 'line-color, target-arrow-color, width, opacity', 'transition-duration': '0.25s', 'arrow-scale': 1.2, 'line-style': ele => rel[ele.data('relationship')]?.style || 'solid' } },
      { selector: 'edge:selected', style: { 'opacity': 1, 'width': ele => (rel[ele.data('relationship')]?.width || 2) + 2, 'z-index': 999 } },
      { selector: 'edge:hover', style: { 'opacity': 1, 'cursor': 'pointer' } },
      { selector: '.highlighted', style: { 'opacity': 1, 'z-index': 999 } },
      { selector: '.dimmed', style: { 'opacity': 0.15 } },
      { selector: '.filtered-out', style: { 'display': 'none' } }
    ];
  }

  setupEventListeners() {
    this.cy.on('tap', 'node', evt => {
      this.displayMemberProfile(evt.target.data());
      this.highlightConnections(evt.target);
      this.openInfoPanel();
    });
    this.cy.on('tap', 'edge', evt => {
      this.displayConnectionInfo(evt.target.data());
      this.openInfoPanel();
    });
    this.cy.on('tap', evt => {
      if (evt.target === this.cy) {
        this.clearHighlights();
        this.showEmptyState();
      }
    });
    this.cy.on('dblclick', evt => {
      if (evt.target === this.cy) this.fitGraph();
    });
  }

  setupControls() {
    document.getElementById('reset-layout').onclick = () => this.applyLayout(document.getElementById('layout-selector').value);
    document.getElementById('fit-graph').onclick = () => this.fitGraph();
    document.getElementById('department-filter').onchange = () => this.applyFilters();
    document.getElementById('relationship-filter').onchange = () => this.applyFilters();
    document.getElementById('search-input').oninput = this.debounce(() => this.applyFilters(), 300);
    document.getElementById('close-panel').onclick = () => this.closeInfoPanel();
    document.getElementById('export-btn').onclick = () => this.exportGraph();
    document.getElementById('fullscreen-btn').onclick = () => this.toggleFullscreen();
  }

  applyLayout(layoutName) {
    if (this.config.layouts[layoutName]) this.cy.layout(this.config.layouts[layoutName]).run();
  }

  fitGraph() { this.cy.fit(); this.cy.center(); }

  applyFilters() {
    const deptFilter = document.getElementById('department-filter').value,
      relFilter = document.getElementById('relationship-filter').value,
      searchTerm = document.getElementById('search-input').value.toLowerCase();
    this.filteredData = JSON.parse(JSON.stringify(this.data));

    if (deptFilter !== 'all') {
      const deptNodes = this.filteredData.nodes.filter(n => n.data.department === deptFilter);
      const deptNodeIds = new Set(deptNodes.map(n => n.data.id));

      if (relFilter === 'all') {
        this.filteredData.edges = this.filteredData.edges.filter(e =>
          deptNodeIds.has(e.data.source) || deptNodeIds.has(e.data.target)
        );
        const connectedNodeIds = new Set();
        this.filteredData.edges.forEach(e => {
          connectedNodeIds.add(e.data.source);
          connectedNodeIds.add(e.data.target);
        });
        this.filteredData.nodes = this.filteredData.nodes.filter(n => connectedNodeIds.has(n.data.id));
      } else {
        this.filteredData.edges = this.filteredData.edges.filter(e =>
          (deptNodeIds.has(e.data.source) || deptNodeIds.has(e.data.target)) &&
          e.data.relationship === relFilter
        );
        const connectedNodeIds = new Set();
        this.filteredData.edges.forEach(e => {
          connectedNodeIds.add(e.data.source);
          connectedNodeIds.add(e.data.target);
        });
        this.filteredData.nodes = this.filteredData.nodes.filter(n => connectedNodeIds.has(n.data.id));
      }
    }

    if (searchTerm) {
      const matchedNodes = this.filteredData.nodes.filter(n =>
        n.data.label.toLowerCase().includes(searchTerm) ||
        n.data.role.toLowerCase().includes(searchTerm) ||
        n.data.skills.some(s => s.toLowerCase().includes(searchTerm))
      );
      const matchedNodeIds = new Set(matchedNodes.map(n => n.data.id));
      const connectedEdges = this.filteredData.edges.filter(e =>
        matchedNodeIds.has(e.data.source) || matchedNodeIds.has(e.data.target)
      );
      const connectedNodeIds = new Set();
      connectedEdges.forEach(e => { connectedNodeIds.add(e.data.source); connectedNodeIds.add(e.data.target); });
      this.filteredData.nodes = this.filteredData.nodes.filter(n => connectedNodeIds.has(n.data.id));
      this.filteredData.edges = connectedEdges;
    }

    const nodeIds = new Set(this.filteredData.nodes.map(n => n.data.id));
    this.filteredData.edges = this.filteredData.edges.filter(e =>
      nodeIds.has(e.data.source) && nodeIds.has(e.data.target)
    );

    this.updateGraph();
    this.updateStats();
  }

  updateGraph() {
    this.cy.elements().remove();
    this.cy.add(this.filteredData.nodes);
    this.cy.add(this.filteredData.edges);
    this.applyLayout(document.getElementById('layout-selector').value);
  }

  updateStats() {
    document.getElementById('total-members').textContent = this.filteredData.nodes.length;
    document.getElementById('total-connections').textContent = this.filteredData.edges.length;
    document.getElementById('departments-count').textContent = new Set(this.filteredData.nodes.map(n => n.data.department)).size;
  }

  populateFilters() {
    const departmentFilter = document.getElementById('department-filter');
    [...new Set(this.data.nodes.map(n => n.data.department))].forEach(dept => {
      const option = document.createElement('option');
      option.value = dept;
      option.textContent = dept;
      departmentFilter.appendChild(option);
    });
  }

  displayMemberProfile(data) {
    const avatar = this.getInitials(data.label), connections = this.getNodeConnections(data.id);
    document.getElementById('member-details').innerHTML = `
      <div class="member-card">
        <div class="member-header">
          <div class="member-avatar" style="background: ${this.config.departments[data.department]?.color || '#64748b'}">${avatar}</div>
          <div class="member-info"><h4>${data.label}</h4><div class="member-role">${data.role}</div></div>
        </div>
        <div class="member-details">
          <div class="detail-item"><i class="fas fa-building"></i><span class="detail-label">Department:</span><span class="detail-value">${data.department}</span></div>
          <div class="detail-item"><i class="fas fa-clock"></i><span class="detail-label">Experience:</span><span class="detail-value">${data.experience}</span></div>
          <div class="detail-item"><i class="fas fa-envelope"></i><span class="detail-label">Email:</span><span class="detail-value">${data.email}</span></div>
        </div>
        <div class="skills-container">
          <div class="detail-item"><i class="fas fa-tools"></i><span class="detail-label">Skills:</span></div>
          <div class="skills-grid">${data.skills.map(skill => `<span class="skill-tag">${skill}</span>`).join('')}</div>
        </div>
        <div class="connections-section">
          <h5><i class="fas fa-network-wired"></i> Connections (${connections.length})</h5>
          ${connections.map(conn => `<div class="connection-item"><span class="connection-type type-${conn.relationship}">${conn.relationshipLabel}</span><span>${conn.targetName}</span></div>`).join('')}
        </div>
      </div>
    `;
  }

  displayConnectionInfo(data) {
    const sourceNode = this.cy.getElementById(data.source), targetNode = this.cy.getElementById(data.target), relationship = this.config.relationships[data.relationship];
    document.getElementById('member-details').innerHTML = `
      <div class="member-card">
        <div class="member-header">
          <div class="member-avatar" style="background: ${relationship?.color || '#64748b'}"><i class="fas fa-link"></i></div>
          <div class="member-info"><h4>Connection Details</h4><div class="member-role">${relationship?.label || data.relationship}</div></div>
        </div>
        <div class="member-details">
          <div class="detail-item"><i class="fas fa-user"></i><span class="detail-label">From:</span><span class="detail-value">${sourceNode.data('label')}</span></div>
          <div class="detail-item"><i class="fas fa-user"></i><span class="detail-label">To:</span><span class="detail-value">${targetNode.data('label')}</span></div>
          <div class="detail-item"><i class="fas fa-chart-line"></i><span class="detail-label">Strength:</span><span class="detail-value">${this.capitalize(data.strength)}</span></div>
          <div class="detail-item"><i class="fas fa-calendar"></i><span class="detail-label">Frequency:</span><span class="detail-value">${this.capitalize(data.frequency)}</span></div>
        </div>
      </div>
    `;
  }

  getNodeConnections(nodeId) {
    return this.data.edges
      .filter(e => e.data.source === nodeId || e.data.target === nodeId)
      .map(e => {
        const isSource = e.data.source === nodeId, otherId = isSource ? e.data.target : e.data.source, otherNode = this.data.nodes.find(n => n.data.id === otherId);
        let relType = e.data.relationship, relLabel = relType;
        if (relType === 'manages') relLabel = isSource ? 'Manages' : 'Managed by';
        else if (relType === 'mentored_by') relLabel = isSource ? 'Mentored by' : 'Mentors';
        else if (relType === 'collaborates') relLabel = 'Collaborates with';
        else if (relType === 'coordinates') relLabel = isSource ? 'Coordinates with' : 'Coordinated by';
        return { relationship: relType, relationshipLabel: relLabel, targetName: otherNode.data.label, targetId: otherId };
      });
  }

  highlightConnections(node) {
    this.clearHighlights();
    node.addClass('highlighted');
    const connectedEdges = node.connectedEdges(), connectedNodes = connectedEdges.connectedNodes();
    connectedEdges.addClass('highlighted');
    connectedNodes.addClass('highlighted');
    this.cy.elements().not(node).not(connectedEdges).not(connectedNodes).addClass('dimmed');
  }

  clearHighlights() { this.cy.elements().removeClass('highlighted dimmed'); }

  openInfoPanel() { document.querySelector('.info-panel').classList.add('open'); }

  closeInfoPanel() {
    document.querySelector('.info-panel').classList.remove('open');
    this.clearHighlights();
    this.showEmptyState();
  }

  showEmptyState() {
    document.getElementById('member-details').innerHTML = `<div class="empty-state"><i class="fas fa-mouse-pointer"></i><p>Click on a team member to view their profile and connections</p></div>`;
  }

  exportGraph() {
    const png64 = this.cy.png({ scale: 2, full: true });
    const link = document.createElement('a');
    link.download = 'team-connection-map.png';
    link.href = png64;
    link.click();
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  }

  hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    overlay.style.opacity = '0';
    setTimeout(() => { overlay.style.display = 'none'; }, 300);
  }

  showError(message) {
    this.hideLoading();
    document.getElementById('member-details').innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle" style="color: #ef4444;"></i><p>${message}</p></div>`;
  }

  getInitials = name => name.split(' ').map(n => n[0]).join('').toUpperCase();
  capitalize = str => str.charAt(0).toUpperCase() + str.slice(1);
  debounce = (func, wait) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };
}

document.addEventListener('DOMContentLoaded', () => {
  window.teamConnectionMap = new TeamConnectionMap();
})
