import React from 'react';
import { PlatformType } from '../types';
import { Twitter, Instagram, Film, Video, AtSign, Globe } from 'lucide-react';

interface PlatformIconProps {
  platform: PlatformType;
  className?: string;
  showLabel?: boolean;
}

export const PlatformIcon: React.FC<PlatformIconProps> = ({ platform, className = "w-4 h-4", showLabel = false }) => {
  const getIcon = () => {
    switch (platform) {
      case 'twitter':
        return <Twitter className={`${className} text-sky-400`} />;
      case 'instagram':
        return <Instagram className={`${className} text-pink-500`} />;
      case 'letterboxd':
        return <Film className={`${className} text-emerald-400`} />;
      case 'tiktok':
        return <Video className={`${className} text-teal-300`} />;
      case 'threads':
        return <AtSign className={`${className} text-purple-400`} />;
      default:
        return <Globe className={`${className} text-amber-400`} />;
    }
  };

  const getLabel = () => {
    switch (platform) {
      case 'twitter':
        return 'X / Twitter';
      case 'instagram':
        return 'Instagram';
      case 'letterboxd':
        return 'Letterboxd';
      case 'tiktok':
        return 'TikTok';
      case 'threads':
        return 'Threads';
      default:
        return platform;
    }
  };

  if (showLabel) {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-xs">
        {getIcon()}
        <span>{getLabel()}</span>
      </span>
    );
  }

  return getIcon();
};

export const getPlatformBg = (platform: PlatformType): string => {
  switch (platform) {
    case 'twitter':
      return 'bg-sky-500/10 border-sky-500/30 text-sky-400';
    case 'instagram':
      return 'bg-pink-500/10 border-pink-500/30 text-pink-400';
    case 'letterboxd':
      return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
    case 'tiktok':
      return 'bg-teal-500/10 border-teal-500/30 text-teal-300';
    case 'threads':
      return 'bg-purple-500/10 border-purple-500/30 text-purple-400';
    default:
      return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
  }
};
