import { 
  VideoCameraIcon,
  ChatBubbleLeftRightIcon,
  NewspaperIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline'

const PLATFORM_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  youtube: {
    label: 'YouTube',
    color: 'text-red-400',
    bg: 'bg-red-500/20 border-red-500/30',
    icon: VideoCameraIcon,
  },
  reddit: {
    label: 'Reddit',
    color: 'text-orange-400',
    bg: 'bg-orange-500/20 border-orange-500/30',
    icon: ChatBubbleLeftRightIcon,
  },
  twitter: {
    label: 'Twitter/X',
    color: 'text-sky-400',
    bg: 'bg-sky-500/20 border-sky-500/30',
    icon: GlobeAltIcon,
  },
  facebook: {
    label: 'Facebook',
    color: 'text-blue-400',
    bg: 'bg-blue-500/20 border-blue-500/30',
    icon: GlobeAltIcon,
  },
  news: {
    label: 'News',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/20 border-emerald-500/30',
    icon: NewspaperIcon,
  },
  other: {
    label: 'Other',
    color: 'text-gray-400',
    bg: 'bg-gray-500/20 border-gray-500/30',
    icon: GlobeAltIcon,
  },
}

interface PlatformBadgeProps {
  platform: string
  size?: 'sm' | 'md'
  showIcon?: boolean
}

export default function PlatformBadge({ platform, size = 'sm', showIcon = true }: PlatformBadgeProps) {
  const config = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.other
  const Icon = config.icon
  
  const sizeClasses = size === 'sm' 
    ? 'px-2 py-0.5 text-xs gap-1' 
    : 'px-3 py-1 text-sm gap-1.5'
  
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'

  return (
    <span className={`inline-flex items-center rounded-full border ${config.bg} ${config.color} ${sizeClasses} font-medium`}>
      {showIcon && <Icon className={iconSize} />}
      {config.label}
    </span>
  )
}

export { PLATFORM_CONFIG }
