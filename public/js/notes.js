/* eslint-env browser, jquery */
/* global moment, serverurl */

require('./locale')

require('../css/cover.css')
require('../css/site.css')

import List from 'list.js'
import S from 'string'

const options = {
  valueNames: ['id', 'text', 'timestamp', 'time', 'tags'],
  item: `<li class="col-xs-12 col-sm-6 col-md-6 col-lg-4">
          <span class="id" style="display:none;"></span>
          <a href="#">
            <div class="item">
              <div class="content">
                <h4 class="text"></h4>
                <p>
                  <i class="timestamp" style="display:none;"></i>
                  <i class="time"></i>
                </p>
                <p class="tags"></p>
              </div>
            </div>
          </a>
        </li>`,
  page: 18,
  pagination: [{
    outerWindow: 1
  }]
}
const noteList = new List('notes', options)

$('.ui-notes').click(() => {
  if (!$('#notes').is(':visible')) {
    $('.section:visible').hide()
    $('#notes').fadeIn()
  }
})

parseNotes(noteList, parseNotesCallback)

function parseToNotes (list, notes, callback) {
  if (!callback) return
  else if (!list || !notes) callback(list, notes)
  else if (notes && notes.length > 0) {
    for (let i = 0; i < notes.length; i++) {
      // parse time to timestamp
      const timestamp = (typeof notes[i].time === 'number' ? moment(notes[i].time) : moment(notes[i].time, 'MMMM Do YYYY, h:mm:ss a'))
      notes[i].timestamp = timestamp.valueOf()
      notes[i].time = timestamp.format('llll')
      // prevent XSS
      notes[i].text = S(notes[i].text).escapeHTML().s
      notes[i].tags = (notes[i].tags && notes[i].tags.length > 0) ? S(notes[i].tags).escapeHTML().s.split(',') : []
      // add to list
      if (notes[i].id && list.get('id', notes[i].id).length === 0) { list.add(notes[i]) }
    }
  }
  callback(list, notes)
}

function parseNotes (list, callback) {
  $.get(`${serverurl}/list`)
    .done(data => {
      if (data.notes) {
        parseToNotes(list, data.notes, callback)
      }
    })
    .fail((xhr, status, error) => {
      console.error(xhr.responseText)
    })
}

function checkNoteList () {
  if ($('#notes-list').children().length > 0) {
    $('.pagination').show()
    $('.ui-nonotes').hide()
  } else if ($('#notes-list').children().length === 0) {
    $('.pagination').hide()
    $('.ui-nonotes').slideDown()
  }
}

function parseNotesCallback (list, notes) {
  checkNoteList()
  // sort by timestamp
  list.sort('', {
    sortFunction (a, b) {
      const notea = a.values()
      const noteb = b.values()
      if (notea.timestamp > noteb.timestamp) {
        return -1
      } else if (notea.timestamp < noteb.timestamp) {
        return 1
      } else {
        return 0
      }
    }
  })
  // parse filter tags
  const filtertags = []
  for (let i = 0, l = list.items.length; i < l; i++) {
    const tags = list.items[i]._values.tags
    if (tags && tags.length > 0) {
      for (const tag of tags) {
        // push info filtertags if not found
        if (!filtertags.includes(tag)) {
          filtertags.push(tag)
        }
      }
    }
  }
  buildTagsFilter(filtertags)
}

// update items whenever list updated
noteList.on('updated', e => {
  for (const item of e.items) {
    if (item.visible()) {
      const itemEl = $(item.elm)
      const values = item._values
      const a = itemEl.find('a')
      const tagsEl = itemEl.find('.tags')
      // parse link to element a
      a.attr('href', `${serverurl}/${values.id}`)
      // parse tags
      const tags = values.tags
      if (tags && tags.length > 0 && tagsEl.children().length <= 0) {
        const labels = []
        for (const tag of tags) {
          // push into the item label
          labels.push(`<span class='label label-default'>${tag}</span>`)
        }
        tagsEl.html(labels.join(' '))
      }
    }
  }
})

$('.ui-refresh-notes').click(() => {
  const lastTags = $('.ui-use-note-tags').select2('val')
  $('.ui-use-note-tags').select2('val', '')
  noteList.filter()
  const lastKeyword = $('.search-notes').val()
  $('.search-notes').val('')
  noteList.search()
  $('#notes-list').slideUp('fast')
  $('.pagination').hide()

  noteList.clear()
  parseNotes(noteList, (list, notes) => {
    parseNotesCallback(list, notes)
    $('.ui-use-note-tags').select2('val', lastTags)
    $('.ui-use-note-tags').trigger('change')
    noteList.search(lastKeyword)
    $('.search-notes').val(lastKeyword)
    checkNoteList()
    $('#notes-list').slideDown('fast')
  })
})

let filtertags = []
$('.ui-use-note-tags').select2({
  placeholder: $('.ui-use-note-tags').attr('placeholder'),
  multiple: true,
  data () {
    return {
      results: filtertags
    }
  }
})
$('.select2-input').css('width', 'inherit')
buildTagsFilter([])

function buildTagsFilter (tags) {
  for (let i = 0; i < tags.length; i++) {
    tags[i] = {
      id: i,
      text: S(tags[i]).unescapeHTML().s
    }
  }
  filtertags = tags
}
$('.ui-use-note-tags').on('change', function () {
  const tags = []
  const data = $(this).select2('data')
  for (let i = 0; i < data.length; i++) { tags.push(data[i].text) }
  if (tags.length > 0) {
    noteList.filter(item => {
      const values = item.values()
      if (!values.tags) return false
      for (let t of tags) {
        if (values.tags.includes(t)) {
          return true
        }
      }
      return false
    })
  } else {
    noteList.filter()
  }
  checkNoteList()
})

$('.search-notes').keyup(checkNoteList)
