Pod::Spec.new do |s|
  s.name           = 'PizzaBakeService'
  s.version        = '1.0.0'
  s.summary        = 'Background bake cues for Pizza Timer'
  s.description    = 'Android keeps the bake alive in a foreground service; this is the iOS stand-in.'
  s.author         = ''
  s.homepage       = 'https://github.com/imbirwmiodzie/pizzamico'
  s.platforms      = { :ios => '15.1', :tvos => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
