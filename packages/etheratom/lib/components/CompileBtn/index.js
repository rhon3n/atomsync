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
import React from 'react'
import { connect } from 'react-redux'

class CompileBtn extends React.Component {
    constructor(props) {
        super(props);
        this._handleSubmit = this._handleSubmit.bind(this);
    }
    async _handleSubmit() {
        const workspaceElement = atom.views.getView(atom.workspace);
        return await atom.commands.dispatch(workspaceElement, 'eth-interface:compile');
    }
    render() {
        const { compiling } = this.props;
        return (
            <form class="row" onSubmit={this._handleSubmit}>
                {
                    compiling &&
                    <input type="submit" value="Compiling..." class="btn copy-btn btn-success" disabled />
                }
                {
                    !compiling &&
                    <input type="submit" value="Compile" class="btn copy-btn btn-success" />
                }
            </form>
        );
    }
}

const mapStateToProps = ({ contract }) => {
	const { compiling } = contract;
	return { compiling };
}

export default connect(mapStateToProps, {})(CompileBtn);
