/** Settings › Downloads: the space and the download preferences of this device. */
import React, { type FC } from 'react';
import { Link } from 'react-router-dom';

import Page from 'components/Page';
import globalize from 'lib/globalize';

import DownloadSettingsPanel from '../../../features/downloads/DownloadSettingsPanel';
import { downloadsAvailable } from '../../../features/downloads/support';

const UserDownloadPreferences: FC = () => (
    <Page id='downloadPreferencesPage' title={globalize.translate('DlPageTitle')} className='mainAnimatedPage libraryPage userPreferencesPage noSecondaryNavPage'>
        <div className='dl-page is-narrow'>
            <header className='dl-head'>
                <h1>{globalize.translate('DlPageTitle')}</h1>
                <p>{globalize.translate('DlSettingsHelp')}</p>
            </header>
            {downloadsAvailable() ? (
                <>
                    <DownloadSettingsPanel />
                    <Link to='/downloads' className='dl-pill is-main'>{globalize.translate('DlSeeDownloads')}</Link>
                </>
            ) : (
                <p className='dl-empty'>{globalize.translate('DlNotAvailable')}</p>
            )}
        </div>
    </Page>
);

export default UserDownloadPreferences;
