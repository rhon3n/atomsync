'use babel'
// Copyright 2018 Etheratom Authors
// This file is part of Etheratom.

// Etheratom is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// Etheratom is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with Etheratom.  If not, see <http://www.gnu.org/licenses/>.

// web3.js should be use to handle all web3 compilation events
// Every solidity file can be compiled in two ways jsvm and ethereum endpoint
// After every command is invoked compilation endpoint should be chosen
// If JsVM is compilation endpoint VM will be used to compile and execute solidity program
import { CompositeDisposable } from 'atom'
import path from 'path'
import fs from 'fs'
import Web3 from 'web3'
import { connect } from 'react-redux'
import Web3Helpers from './methods'
import { combineSource } from '../helpers/compiler-imports'
import View from './view'
import {
	SET_COMPILED,
	ADD_INTERFACE,
	SET_COMPILING,
	SET_ERRORS,
	ADD_PENDING_TRANSACTION,
	SET_EVENTS,
	SET_GAS_LIMIT,
	SET_SYNC_STATUS,
	SET_SYNCING
} from '../actions/types'

export default class Web3Env {
	constructor(store) {
		this.subscriptions = new CompositeDisposable();
		this.web3Subscriptions = new CompositeDisposable();
		this.saveSubscriptions = new CompositeDisposable();
		this.compileSubscriptions = new CompositeDisposable();
		this.store = store;
		this.observeConfig();
	}
	dispose() {
		if(this.subscriptions) {
			this.subscriptions.dispose()
		}
		this.subscriptions = null

		if(this.saveSubscriptions) {
			this.saveSubscriptions.dispose()
		}
		this.saveSubscriptions = null

		if(this.web3Subscriptions) {
			this.web3Subscriptions.dispose()
		}
		this.web3Subscriptions = null
	}
	destroy() {
		if(this.saveSubscriptions) {
			this.saveSubscriptions.dispose()
		}
		this.saveSubscriptions = null

		if(this.compileSubscriptions) {
			this.compileSubscriptions.dispose()
		}
		this.compileSubscriptions = null

		if(this.web3Subscriptions) {
			this.web3Subscriptions.dispose()
		}
		this.web3Subscriptions = null
	}
	observeConfig() {
		this.subscriptions.add(atom.config.observe('etheratom.executionEnv', (executionEnv) => {
			if(this.web3Subscriptions) {
				this.destroy();
			}
			this.web3Subscriptions = new CompositeDisposable();
			if(executionEnv == 'web3') {
				this.subscribeToWeb3Commands();
				this.subscribeToWeb3Events();
			} else {
				return;
			}
		}));
		this.subscriptions.add(atom.config.onDidChange('etheratom.executionEnv', (envChange) => {
			if(envChange.newValue !== 'web3') {
				this.destroy();
			}
			if(envChange.newValue == 'web3') {
				if(this.web3Subscriptions) {
					this.web3Subscriptions.dispose();
				}
				this.web3Subscriptions = new CompositeDisposable();
				this.subscribeToWeb3Commands();
				this.subscribeToWeb3Events();
			}
		}));
	}

	// Subscriptions
	subscribeToWeb3Commands() {
		if(!this.web3Subscriptions) {
			return
		}
		this.web3Subscriptions.add(atom.commands.add('atom-workspace', 'eth-interface:compile', () => {
			if(this.compileSubscriptions) {
				this.compileSubscriptions.dispose();
			}
			this.compileSubscriptions = new CompositeDisposable();
			this.subscribeToCompileEvents();
		}));
	}
	subscribeToWeb3Events() {
		if(!this.web3Subscriptions) {
			return
		}
		const rpcAddress = atom.config.get('etheratom.rpcAddress');
		const websocketAddress = atom.config.get('etheratom.websocketAddress')
		if(typeof this.web3 !== 'undefined') {
			this.web3 = new Web3(this.web3.currentProvider);
		} else {
			this.web3 = new Web3(Web3.givenProvider || new Web3.providers.HttpProvider(rpcAddress));
			if(websocketAddress) {
				this.web3.setProvider(new Web3.providers.WebsocketProvider(websocketAddress));
			}
			this.helpers = new Web3Helpers(this.web3);
		}
		this.view = new View(this.store, this.web3);
		if(Object.is(this.web3.currentProvider.constructor, Web3.providers.WebsocketProvider)) {
			console.log("%c Provider is websocket. Creating subscriptions... ", 'background: rgba(36, 194, 203, 0.3); color: #EF525B');
			// newBlockHeaders subscriber
			this.web3.eth.subscribe('newBlockHeaders')
				.on("data", (blocks) => {
					console.log("%c newBlockHeaders:data ", 'background: rgba(36, 194, 203, 0.3); color: #EF525B');
					console.log(blocks);
				})
				.on('error', (e) => {
					console.log("%c newBlockHeaders:error ", 'background: rgba(36, 194, 203, 0.3); color: #EF525B');
					console.log(e);
				})
			// pendingTransactions subscriber
			this.web3.eth.subscribe('pendingTransactions')
				.on("data", (transaction) => {
					console.log("%c pendingTransactions:data ", 'background: rgba(36, 194, 203, 0.3); color: #EF525B');
					console.log(transaction);
					this.store.dispatch({ type: ADD_PENDING_TRANSACTION, payload: transaction });
				})
				.on('error', (e) => {
					console.log("%c pendingTransactions:error ", 'background: rgba(36, 194, 203, 0.3); color: #EF525B');
					console.log(e);
				})
			// syncing subscription
			this.web3.eth.subscribe('syncing')
				.on("data", (sync) => {
					console.log("%c syncing:data ", 'background: rgba(36, 194, 203, 0.3); color: #EF525B');
					console.log(sync);
					if(typeof(sync) === 'boolean') {
						this.store.dispatch({ type: SET_SYNCING, payload: sync });
					}
					if(typeof(sync) === 'object') {
						this.store.dispatch({ type: SET_SYNCING, payload: sync.syncing });
						const status = {
							currentBlock: sync.status.CurrentBlock,
							highestBlock: sync.status.HighestBlock,
							knownStates: sync.status.KnownStates,
							pulledStates: sync.status.PulledStates,
							startingBlock: sync.status.StartingBlock
						}
						this.store.dispatch({ type: SET_SYNC_STATUS, payload: status });
					}
				})
				.on('changed', (isSyncing) => {
					console.log("%c syncing:changed ", 'background: rgba(36, 194, 203, 0.3); color: #EF525B');
					console.log(isSyncing);
				})
				.on('error', (e) => {
					console.log("%c syncing:error ", 'background: rgba(36, 194, 203, 0.3); color: #EF525B');
					console.log(e);
				})
		}
		this.checkConnection((error, connection) => {
			if(error) {
				this.helpers.showPanelError(error);
			} else if(connection) {
				this.view.createCompilerOptionsView();
				this.view.createCoinbaseView();
				this.view.createButtonsView();
				this.view.createTabView();
				this.view.createErrorView();
			}
		});
		this.web3Subscriptions.add(atom.workspace.observeTextEditors((editor) => {
			if(!editor || !editor.getBuffer()) {
				return
			}

			this.web3Subscriptions.add(atom.config.observe('etheratom.compileOnSave', (compileOnSave) => {
				if(this.saveSubscriptions) {
					this.saveSubscriptions.dispose();
				}
				this.saveSubscriptions = new CompositeDisposable();
				if(compileOnSave) {
					this.subscribeToSaveEvents();
				}
			}));
		}));
	}

	// Event subscriptions
	subscribeToSaveEvents() {
		if(!this.web3Subscriptions) {
			return
		}
		this.saveSubscriptions.add(atom.workspace.observeTextEditors((editor) => {
			if(!editor || !editor.getBuffer()) {
				return
			}

			const bufferSubscriptions = new CompositeDisposable()
			bufferSubscriptions.add(editor.getBuffer().onDidSave((filePath) => {
				this.compile(editor)
			}))
			bufferSubscriptions.add(editor.getBuffer().onDidDestroy(() => {
				bufferSubscriptions.dispose()
			}))
			this.saveSubscriptions.add(bufferSubscriptions)
		}));
	}
	subscribeToCompileEvents() {
		if(!this.web3Subscriptions) {
			return
		}
		this.compileSubscriptions.add(atom.workspace.observeTextEditors((editor) => {
			if(!editor || !editor.getBuffer()) {
				return
			}
			this.compile(editor);
		}));
	}

	// common functions
	checkConnection(callback) {
		let haveConn;
		haveConn = this.web3.currentProvider;
		if(!haveConn) {
			return callback('Error could not connect to local geth instance!', null);
		} else {
			return callback(null, true);
		}
	}
	async compile(editor) {
		const filePath = editor.getPath();
		const filename = filePath.replace(/^.*[\\\/]/, '');

		if(filePath.split('.').pop() == 'sol') {
			console.log("%c Compiling contract... ", 'background: rgba(36, 194, 203, 0.3); color: #EF525B');
			this.store.dispatch({ type: SET_COMPILING, payload: true });
			const dir = path.dirname(filePath);
			var sources = {};
			sources[filename] = { content: editor.getText() }
			sources = await combineSource(dir, sources);
			console.log(sources);
			try {
				// Reset redux store
				this.store.dispatch({ type: SET_COMPILED, payload: null });
				this.store.dispatch({ type: SET_ERRORS, payload: [] });
				this.store.dispatch({ type: SET_EVENTS, payload: [] });
				const compiled = await this.helpers.compileWeb3(sources);
				this.store.dispatch({ type: SET_COMPILED, payload: compiled });
				if(compiled.contracts) {
					for(const [fileName, contracts] of Object.entries(compiled.contracts)) {
						for(const [contractName, contract] of Object.entries(contracts)) {
							// Add interface to redux
							this.store.dispatch({ type: ADD_INTERFACE, payload: { contractName, interface: contract.abi } });
						}
					}
				}
				if(compiled.errors) {
					this.store.dispatch({ type: SET_ERRORS, payload: compiled.errors });
				}
				const gasLimit = await this.helpers.getGasLimit();
				this.store.dispatch({ type: SET_GAS_LIMIT, payload: gasLimit });
				this.store.dispatch({ type: SET_COMPILING, payload: false });
			} catch (e) {
				console.log(e);
				this.helpers.showPanelError(e);
			}
		} else {
			return;
		}
	}
}
