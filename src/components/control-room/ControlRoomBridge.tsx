"use client";
import {useEffect} from 'react';
import {getControlSettings} from '@/lib/control-room/store';
import {beginAutomaticCloudSync} from '@/lib/cloud-vault/client';
export default function ControlRoomBridge(){useEffect(()=>{void getControlSettings().then(settings=>localStorage.setItem('atlas-control-preferences',JSON.stringify(settings))).catch(()=>{});return beginAutomaticCloudSync();},[]);return null;}
